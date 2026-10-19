import {execFileSync} from 'node:child_process';
// Shared harness: bundle Worker modules with esbuild and run them against a
// private copy of the imported D1 snapshot with the Worker migrations applied.
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {crc32,deflateSync} from 'node:zlib';
import {build} from 'esbuild';

let originalDirectory;
export function renderOriginalLocally(payload) {
  if(!originalDirectory){
    originalDirectory=mkdtempSync(join(tmpdir(),'refpahang-original-'));
    const module=readFileSync(new URL('../legacy-renderer/bundle.generated.mjs',import.meta.url),'utf8');
    writeFileSync(join(originalDirectory,'bundle.zip'),Buffer.from(JSON.parse(module.match(/export default ("[^";]+")/)[1]),'base64'));
    execFileSync('php',['-r',"$z=new ZipArchive();$z->open($argv[1].'/bundle.zip');$z->extractTo($argv[1]);$z->close();mkdir($argv[1].'/request');",originalDirectory],{stdio:'pipe'});
    copyFileSync(new URL('../../assets/Pahang_FA_logo.png',import.meta.url),join(originalDirectory,'assets/Pahang_FA_logo.png'));
    process.on('exit',()=>rmSync(originalDirectory,{recursive:true,force:true}));
  }
  return JSON.parse(execFileSync('php',[new URL('../legacy-renderer/scripts/render-native.php',import.meta.url).pathname,originalDirectory],
    {input:JSON.stringify(payload),maxBuffer:12_000_000,stdio:['pipe','pipe','pipe']}).toString());
}

export async function bundle(contents) {
  const directory=mkdtempSync(join(tmpdir(),'refpahang-bundle-'));
  const file=join(directory,'bundle.mjs');
  const result=await build({stdin:{contents:contents+"\nexport {setOriginalRendererForTests as __originalRenderer} from '../src/original-templates';",resolveDir:new URL('.',import.meta.url).pathname,
    loader:'ts'},bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent',
    external:['cloudflare:sockets'],
  });
  writeFileSync(file,result.outputFiles[0].text);
  try {const module=await import(file);module.__originalRenderer(async payload=>renderOriginalLocally(payload));return module;} finally {rmSync(directory,{recursive:true,force:true});}
}

export function openDatabase(migrations) {
  const directory=mkdtempSync(join(tmpdir(),'refpahang-db-'));
  const path=join(directory,'db.sqlite');
  const snapshot=process.env.REFPAHANG_TEST_SNAPSHOT ??
    new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51_v2.sqlite',import.meta.url);
  copyFileSync(snapshot,path);
  const db=new DatabaseSync(path);
  // Every Worker write path may queue notices, so the outbox is always present.
  for (const file of [...migrations.filter((name)=>name!=='0024_notification_outbox'),'0024_notification_outbox',...(!migrations.includes('0027_profile_class1_years')?['0027_profile_class1_years']:[])]) {
    db.exec(readFileSync(new URL(`../migrations/${file}.sql`,import.meta.url),'utf8'));
  }
  for (const name of ['0028_push_devices','0029_webpush_subscriptions','0031_account_inactive_reason']) {
    if (!migrations.includes(name)) db.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  }
  // Imported flag value can predate the file-based PHP maintenance state.
  // Route tests exercise normal operation; staging-auth explicitly tests maintenance.
  db.prepare("UPDATE application_settings SET setting_value='0' WHERE setting_key='maintenance_mode'").run();
  const hooks={beforeBatch:null};
  // Remote D1 reports total_changes(), so rows written by the ON UPDATE
  // triggers of migration 0009 are counted too; SQLite's own count is not.
  const totalChanges=()=>db.prepare('SELECT total_changes() AS n').get().n;
  const runCounted=(sql,values)=>{
    const before=totalChanges();
    const {lastInsertRowid}=db.prepare(sql).run(...values);
    return {meta:{changes:totalChanges()-before,last_row_id:Number(lastInsertRowid)}};
  };
  class Statement {
    constructor(sql,values=[]){this.sql=sql;this.values=values;}
    bind(...values){return new Statement(this.sql,values);}
    async first(){return db.prepare(this.sql).get(...this.values)??null;}
    async all(){return {results:db.prepare(this.sql).all(...this.values)};}
    async run(){return runCounted(this.sql,this.values);}
    runSync(){
      const statement=db.prepare(this.sql);
      // D1 batch returns result rows for reads (and RETURNING), alongside write metadata.
      if(statement.columns().length){
        const before=totalChanges();
        const results=statement.all(...this.values);
        return {results,meta:{changes:totalChanges()-before,
          last_row_id:Number(db.prepare('SELECT last_insert_rowid() AS id').get().id)}};
      }
      return runCounted(this.sql,this.values);
    }
  }
  const DB={prepare:(sql)=>new Statement(sql),batch:async(statements)=>{
    if (hooks.beforeBatch) {const callback=hooks.beforeBatch;hooks.beforeBatch=null;callback();}
    db.exec('BEGIN');
    try {const result=statements.map((statement)=>statement.runSync());db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  return {db,DB,hooks,close(){db.close();rmSync(directory,{recursive:true,force:true});}};
}

/** A real Worker session for userId, returned as a Cookie header value. */
export async function sessionCookie(db,userId,cookieName='refpahang_session') {
  db.exec(`CREATE TABLE IF NOT EXISTS worker_sessions (token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)`);
  const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  const now=Math.floor(Date.now()/1000);
  // A freshly authenticated fixture is active now, regardless of snapshot age.
  db.prepare('UPDATE users SET last_activity_at=? WHERE id=?').run(now,userId);
  db.prepare('INSERT INTO worker_sessions VALUES (?,?,?,?)').run(hash,userId,now,now+3600);
  return `${cookieName}=${token}`;
}

// A 150x150 grey PNG: the smallest profile picture the form accepts.
export function testPng(size=150) {
  const chunk=(type,data)=>{
    const body=Buffer.concat([Buffer.from(type),data]);
    const length=Buffer.alloc(4);length.writeUInt32BE(data.length);
    const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length,body,crc]);
  };
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=0;
  const rows=Buffer.alloc(size*(size+1),0x80);
  for (let row=0;row<size;row++) rows[row*(size+1)]=0;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}

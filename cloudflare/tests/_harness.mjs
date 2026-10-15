// Shared harness: bundle Worker modules with esbuild and run them against a
// private copy of the imported D1 snapshot with the Worker migrations applied.
import {copyFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

export async function bundle(contents) {
  const directory=mkdtempSync(join(tmpdir(),'refpahang-bundle-'));
  const file=join(directory,'bundle.mjs');
  const result=await build({stdin:{contents,resolveDir:new URL('.',import.meta.url).pathname,
    loader:'ts'},bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent',
  });
  writeFileSync(file,result.outputFiles[0].text);
  try {return await import(file);} finally {rmSync(directory,{recursive:true,force:true});}
}

export function openDatabase(migrations) {
  const directory=mkdtempSync(join(tmpdir(),'refpahang-db-'));
  const path=join(directory,'db.sqlite');
  copyFileSync(new URL('../../output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite',import.meta.url),path);
  const db=new DatabaseSync(path);
  for (const file of migrations) {
    db.exec(readFileSync(new URL(`../migrations/${file}.sql`,import.meta.url),'utf8'));
  }
  const hooks={beforeBatch:null};
  class Statement {
    constructor(sql,values=[]){this.sql=sql;this.values=values;}
    bind(...values){return new Statement(this.sql,values);}
    async first(){return db.prepare(this.sql).get(...this.values)??null;}
    async all(){return {results:db.prepare(this.sql).all(...this.values)};}
    async run(){const result=db.prepare(this.sql).run(...this.values);return {meta:{changes:result.changes}};}
    runSync(){const result=db.prepare(this.sql).run(...this.values);return {meta:{changes:result.changes}};}
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
  db.prepare('INSERT INTO worker_sessions VALUES (?,?,?,?)').run(hash,userId,now,now+3600);
  return `${cookieName}=${token}`;
}

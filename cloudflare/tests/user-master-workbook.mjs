import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {bundle,openDatabase,sessionCookie} from './_harness.mjs';

const requireFrontend=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ExcelJS=requireFrontend('exceljs');
const compiled=await build({entryPoints:[new URL('../../frontend/src/app/features/admin/users/master-data-workbook.ts',import.meta.url).pathname],
  bundle:true,platform:'node',format:'cjs',external:['exceljs'],write:false,logLevel:'silent'});
const module={exports:{}};
// Evaluate our compiled module with the same ExcelJS package used by the application.
new Function('module','exports','require',compiled.outputFiles[0].text)(module,module.exports,requireFrontend);
const {buildUserMasterWorkbook,masterCell,masterDate}=module.exports;
const {adminUserMasterData}=await bundle("export {adminUserMasterData} from '../src/user-master-data';");
const {db,DB,close}=openDatabase(['0001_worker_sessions','0019_annual_seminar_attendance']);
try {
  const admin=db.prepare("SELECT id FROM users WHERE role='Admin' AND aktif=1 LIMIT 1").get();
  const cookie=await sessionCookie(db,admin.id);
  const response=await adminUserMasterData(new Request('https://refpahang.example/api/admin-users-master-data.php?year=2026',{headers:{Cookie:cookie}}),
    {DB,STAGING_AUTH_ENABLED:'1',STAGING_WRITES_ENABLED:'1'});
  assert.equal(response.status,200);
  const {data}=await response.json();
  // Representative identifiers and malicious-looking literals must remain exact text in XLSX.
  Object.assign(data.sheets[0].rows[0],{no_ic:'001234567890',no_telefon:'+60123456789',poskod:'00001',nama_penuh:'=HYPERLINK("https://invalid.test","test")'});
  const started=performance.now();
  const book=buildUserMasterWorkbook(data);
  assert.equal(book.worksheets[0].name,'Master Pengguna');
  const bytes=await book.xlsx.writeBuffer();
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(bytes);
  const source=data.sheets.filter(sheet=>sheet.key==='users'||sheet.rows.length);
  for(const dataset of source){
    const sheet=reopened.getWorksheet(dataset.name);
    assert.equal(sheet.rowCount,dataset.rows.length+5,`${dataset.name}: rows`);
    const tables=Object.values(sheet.tables);assert.equal(tables.length,1);
    assert.equal(tables[0].table.tableRef,`A5:${sheet.getColumn(dataset.columns.length).letter}${dataset.rows.length+5}`);
    assert.equal(sheet.views[0].xSplit,3);assert.equal(sheet.views[0].ySplit,5);
    assert.equal(sheet.views[0].showGridLines,false);
    assert.equal(sheet.getCell('A2').font.size,14);
    assert.equal(sheet.getCell('A5').fill.fgColor.argb,'FF111827');
    assert.equal(sheet.getCell('A5').font.color.argb,'FFFFFFFF');
    if(dataset.rows.length)assert.notEqual(sheet.getCell(dataset.rows.length+5,1).font.bold,true);
    // Check first/middle/last records, including blanks, zeroes, dates and every column.
    for(const index of new Set([0,Math.floor(dataset.rows.length/2),dataset.rows.length-1])){
      if(index<0)continue;
      dataset.columns.forEach((column,col)=>{
        const actual=sheet.getCell(index+6,col+1).value;
        const expected=masterCell(dataset.rows[index][column.key],column);
        if(expected instanceof Date)assert.equal(actual.toISOString(),expected.toISOString(),`${dataset.name} ${column.key}`);
        else assert.equal(actual,expected,`${dataset.name} ${column.key}`);
      });
    }
    sheet.eachRow(row=>row.eachCell(cell=>assert.notEqual(cell.type,ExcelJS.ValueType.Formula)));
  }
  const master=reopened.getWorksheet('Master Pengguna');
  for(const [key,value] of [['no_ic','001234567890'],['no_telefon','+60123456789'],['poskod','00001'],['nama_penuh','=HYPERLINK("https://invalid.test","test")']]){
    const column=data.sheets[0].columns.findIndex(column=>column.key===key)+1;
    assert.equal(master.getCell(6,column).value,value);assert.equal(master.getCell(6,column).type,ExcelJS.ValueType.String);
  }
  assert.equal(masterDate('2026-02-30'),'2026-02-30');assert.equal(masterDate('0000-00-00'),'0000-00-00');
  assert.equal(masterDate('2026-10-16 09:30:00').toISOString(),'2026-10-16T09:30:00.000Z');
  assert.equal(masterDate('2026-10-16T01:30:00Z').toISOString(),'2026-10-16T09:30:00.000Z');
  assert.throws(()=>masterCell('A'.repeat(32768),{label:'Catatan',type:'note'}),/melebihi had/);
  const empty=buildUserMasterWorkbook({...data,sheets:[{...data.sheets[0],rows:[]}]});
  await empty.xlsx.writeBuffer();assert.equal(empty.getWorksheet('Master Pengguna').rowCount,5);
  const directory=new URL('../../output/cloudflare/master-data-qa/',import.meta.url);mkdirSync(directory,{recursive:true});
  writeFileSync(new URL('master-data-qa.xlsx',directory),bytes,{mode:0o600});
  // A small preview keeps the full headers/layout while avoiding a large renderer import.
  const preview=buildUserMasterWorkbook({...data,sheets:data.sheets.map(sheet=>({...sheet,rows:sheet.rows.slice(0,3)}))});
  writeFileSync(new URL('master-data-preview.xlsx',directory),await preview.xlsx.writeBuffer(),{mode:0o600});
  console.log(JSON.stringify({users:data.sheets[0].rows.length,records:source.reduce((sum,sheet)=>sum+sheet.rows.length,0),sheets:reopened.worksheets.length,
    bytes:bytes.byteLength,elapsed_seconds:Math.round((performance.now()-started)/100)/10,
    passed:'Native tables/filters/freeze panes, styled headers, first/middle/last field round trips, leading zeros, literal formula safety, dates, empty users and oversize-text rejection'}));
}finally {close();}

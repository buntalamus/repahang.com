import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/chair-config.ts', import.meta.url), 'utf8')
  .replace("import { currentUser, json } from './auth';", `
    const currentUser = async () => globalThis.chairUser;
    const json = (value, status=200) => Response.json(value, {status});`)
  .replace("import { phpInt } from './lantikan-write';", 'const phpInt = Number;')
  .replace("import { auditMetaFrom } from './php/lantikan-audit';", 'const auditMetaFrom = () => ({});')
  .replace("import { dispatchLaporanForPengerusi, getKejohananPengesahLaporan } from './php/laporan-pengesahan';",
    'const dispatchLaporanForPengerusi = () => { throw new Error(\'Unexpected write\'); };'
    + 'const getKejohananPengesahLaporan = dispatchLaporanForPengerusi;')
  .replace("import { notifyUser } from './notify';", 'const notifyUser = async () => { throw new Error(\'Unexpected notice\'); };')
  .replace("import type { Recipient } from './notify';", '')
  .replace("import { boundedJson } from './request';",
    'const boundedJson = async () => { throw new Error(\'Unexpected body read\'); };');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { chairConfig } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

let dbReads = 0;
const binds = [];
const env = { DB: { prepare: (sql) => {
  assert.match(sql, /^\s*SELECT\s/i, 'Read-only route must never write');
  return { bind: (...values) => {
    binds.push(values);
    return {
      first: async () => {
        dbReads++;
        if (sql.includes('FROM kejohanan WHERE')) return globalThis.tournament;
        if (sql.includes('FROM kejohanan_pengesah_laporan kp')) return {
          id: 3, kejohanan_id: 4, nama_snapshot: 'Pengerusi A',
          telegram_chat_id: 'secret-chat-id', jenis_sumber: 'Berdaftar',
        };
        throw new Error('Unknown first query');
      },
      all: async () => {
        dbReads++;
        if (sql.includes('UNION ALL')) return { results: [{
          source: 'Berdaftar', official_id: 9, nama: 'Pengerusi A',
          telegram_chat_id: 'secret-chat-id', dalam_pool: 1,
        }] };
        if (sql.includes('kejohanan_pengesah_laporan_audit')) return { results: [{
          id: 2, old_identity_json: null,
          new_identity_json: '{"source":"Berdaftar"}', actor_user_id: 1,
        }] };
        throw new Error('Unknown all query');
      },
    };
  } };
} } };
const url = 'https://staging.example.test/api/kejohanan-pengesah-laporan.php?kejohanan_id=4';
globalThis.tournament = { id: 4, nama: 'Piala Ujian', status: 'Aktif' };
globalThis.chairUser = null;
assert.equal((await chairConfig(new Request(url), env)).status, 401);
globalThis.chairUser = { id: 9, role: 'Pengadil' };
assert.equal((await chairConfig(new Request(url), env)).status, 403);
assert.equal(dbReads, 0, 'Non Admin must not read chair identities');
globalThis.chairUser = { id: 1, role: 'Admin' };
assert.equal((await chairConfig(new Request(url, { method: 'POST' }), env)).status, 503);
assert.equal(dbReads, 0, 'Chair writes remain unavailable');
assert.equal((await chairConfig(new Request(url.replace('=4', '=x')), env)).status, 400);
assert.equal(dbReads, 0);
globalThis.tournament = null;
assert.equal((await chairConfig(new Request(url), env)).status, 404);
globalThis.tournament = { id: 4, nama: 'Piala Ujian', status: 'Aktif' };
binds.length = 0;
const response = await chairConfig(new Request(url), env);
assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.data.current.telegram_linked, true);
assert.equal(payload.data.candidates[0].telegram_linked, true);
assert.equal(payload.data.candidates[0].dalam_pool, true);
assert.deepEqual(payload.data.audit[0].new_identity, { source: 'Berdaftar' });
assert.equal(payload.data.audit[0].old_identity, null);
assert.doesNotMatch(JSON.stringify(payload), /secret-chat-id|identity_json/);
assert.deepEqual(binds, [[4], [4, 4], [4], [4]]);
console.log('chair config: Admin-only lookup, tournament scoping, redaction and write gate passed');

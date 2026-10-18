import {bundle} from './_harness.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/futsal-form.ts', import.meta.url), 'utf8')
  .replace("import { currentUser } from './auth';", 'const currentUser = async () => globalThis.futsalUser;');
const {futsalForm}=await bundle(source.replace("from './original-templates'","from '../src/original-templates'"));

let boundId = null;
let dbReads = 0;
let renderedHtml = '';
const pdf = new TextEncoder().encode('%PDF-1.7\n% test');
const env = {
  BROWSER: { quickAction: async (action, options) => {
    assert.equal(action, 'pdf');
    assert.equal(options.cacheTTL, 0);
    renderedHtml = options.html;
    return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
  } },
  DB: { prepare: (sql) => {
    assert.match(sql, /p\.user_id=\?/);
    assert.match(sql, /lower\(p\.status\)='approved'/);
    assert.match(sql, /ORDER BY p\.tarikh_hantar DESC,p\.id DESC/);
    return { bind: (id) => {
      boundId = id;
      return { first: async () => { dbReads++; return globalThis.futsalApplication; } };
    } };
  } },
};
const url = 'https://staging.example.test/api/download-borang-futsal.php';
globalThis.futsalUser = null;
globalThis.futsalApplication = null;
assert.equal((await futsalForm(new Request(url), env)).status, 403);
globalThis.futsalUser = { id: 7, role: 'Penilai' };
assert.equal((await futsalForm(new Request(url), env)).status, 403);
assert.equal(dbReads, 0, 'Unauthorized users must not query personal data');
globalThis.futsalUser = { id: 8, role: 'Pengadil' };
assert.equal((await futsalForm(new Request(url, { method: 'POST' }), env)).status, 405);
assert.equal(dbReads, 0, 'Unsupported methods must not query personal data');
assert.equal((await futsalForm(new Request(url), env)).status, 403);
assert.equal(boundId, 8, 'The query must be restricted to the session owner');

globalThis.futsalApplication = {
  tahun_permohonan: 2027, nama_penuh: 'Pengadil <script>alert(1)</script>',
  no_ic: '700101010101', email: 'test@example.test', no_telefon: '0123456789',
  jantina: 'Lelaki', jenis_pengadil: 'Pengadil Futsal', tahun_mula_aktif: 2020,
  alamat1: 'Alamat panjang '.repeat(30), alamat2: null, poskod: '26000',
  daerah: 'Kuantan', negeri: 'Pahang', status_kerja: 'Pelajar', jawatan: null,
  nama_majikan: null, nama_waris: 'Waris', hubungan_waris: 'Bapa',
  telefon_waris: '0111111111', saiz_baju: 'L',
};
const response = await futsalForm(new Request(url), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get('Content-Type'), 'application/pdf');
assert.match(response.headers.get('Content-Disposition'), /Borang_Pendaftaran_Pengadil_Futsal_R3_/);
assert.match(response.headers.get('Cache-Control'), /no-store/);
assert.deepEqual(new Uint8Array(await response.arrayBuffer()), pdf);
const body = renderedHtml;
assert.match(body, /BORANG PENDAFTARAN PENGADIL FUTSAL \(R3\)/);
assert.match(body, /Tahun: 2027/);
assert.match(body, /Pengadil &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(body, /Pengadil <script>alert/);
assert.match(body, /Alamat panjang Alamat panjang/);
assert.doesNotMatch(body, /Nama Majikan:/, 'Student employment fields remain hidden');
assert.doesNotMatch(body, /Cetak \/ Simpan PDF/);
assert.doesNotMatch(body, /window\.print/);
assert.match(body,/form-row/); // Original PHP layout, not the translated layout.
console.log('futsal R3: authorization, owner query, rendering, escaping and PDF MIME passed');

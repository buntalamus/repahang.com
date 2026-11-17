import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const frontend = new URL('../../frontend/', import.meta.url).pathname;
const directory = mkdtempSync(join(frontend, 'node_modules/fam-export-'));
const require = createRequire(join(directory, 'test.cjs'));
const { Workbook } = require('exceljs');
try {
  const entry = join(directory, 'workbook.cjs');
  await build({ entryPoints: [join(frontend, 'src/app/features/admin/applications/fam-class-one-workbook.ts')],
    outfile: entry, bundle: true, platform: 'node', format: 'cjs', external: ['exceljs'] });
  const { buildFamClassOneWorkbook, candidateBirthDate } = require(entry);
  const bytes = readFileSync(join(frontend, 'public/templates/fam-calon-kelas1.xlsx'));
  const template = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '8795425e674ae65eef09273054c5a58101d9b1ff997ecbabd8786fd730ce5612', 'official source is byte-exact');
  const original = new Workbook();
  await original.xlsx.load(template);
  const source = original.worksheets[0];
  assert.equal(candidateBirthDate('000229-06-1234', 2026)?.toISOString(), '2000-02-29T00:00:00.000Z');
  assert.equal(candidateBirthDate('990229061234', 2026), null);
  assert.equal(candidateBirthDate('010231061234', 2026), null);
  assert.equal(candidateBirthDate('001201', 2026), null);
  assert.equal(candidateBirthDate('abc000101061234', 2026), null);
  assert.equal(candidateBirthDate('941231061234', 2026)?.getUTCFullYear(), 1994);
  await assert.rejects(buildFamClassOneWorkbook(template, [], 2026), /Tiada permohonan/);
  await assert.rejects(buildFamClassOneWorkbook(template, [{ nama_penuh: 'TEST' }], 0), /Tahun/);

  for (const count of [1, 50, 51, 101]) {
    const candidates = Array.from({ length: count }, (_, index) => ({
      nama_penuh: index === 0 ? '=TEST & <CALON>' : `CALON UJIAN ${index + 1}`,
      no_kp: index === 0 ? '000229061234' : index === 1 ? '' : '941231-06-1234',
    }));
    const workbook = await buildFamClassOneWorkbook(template, candidates, 2026);
    const serialized = await workbook.xlsx.writeBuffer();
    const exported = new Workbook();
    await exported.xlsx.load(serialized);
    assert.equal(exported.worksheets.length, Math.ceil(count / 50));
    for (let page = 0; page < exported.worksheets.length; page++) {
      const sheet = exported.worksheets[page];
      assert.equal(sheet.rowCount, 64);
      assert.equal(sheet.getCell('A3').text, 'Peperiksaan Bertulis Pengadil Kelas 1 FAM  - 2026');
      assert.equal(sheet.getCell('B5').text, 'PB Negeri: PAHANG');
      assert.equal(sheet.getCell('B60').text, 'PENGESAHAN PB NEGERI');
      assert.equal(sheet.getCell('B64').text, 'SETIAUSAHA');
      assert.deepEqual(sheet.model.merges, source.model.merges);
      assert.equal(sheet.getImages().length, 1, 'each form retains the official logo');
      const imageId = sheet.getImages()[0].imageId;
      const originalImageId = source.getImages()[0].imageId;
      assert.deepEqual(exported.getImage(Number(imageId)).buffer, original.getImage(Number(originalImageId)).buffer);
      for (let column = 1; column <= 7; column++) {
        assert.equal(sheet.getColumn(column).width, source.getColumn(column).width);
        assert.equal(sheet.getColumn(column).hidden, source.getColumn(column).hidden);
        assert.equal(sheet.getCell(8, column).text, source.getCell(8, column).text);
        assert.deepEqual(sheet.getCell(8, column).style, source.getCell(8, column).style);
      }
      for (let index = 0; index < 50; index++) {
        const candidate = candidates[page * 50 + index];
        const row = index + 9;
        assert.equal(sheet.getCell(row, 2).text, candidate?.nama_penuh || '');
        assert.equal(sheet.getCell(row, 3).text, candidate?.no_kp || '');
        assert.equal(sheet.getCell(row, 2).formula, undefined, 'names must remain text');
        assert.equal(sheet.getCell(row, 4).value, null);
        assert.equal(sheet.getCell(row, 7).value, null);
        assert.equal(sheet.getCell(row, 5).formula, undefined, 'no inherited #VALUE shared formulas');
        assert.equal(sheet.getCell(row, 6).formula, undefined);
        if (candidate) assert.equal(sheet.getCell(row, 1).value, page * 50 + index + 1);
      }
    }
    assert.equal(exported.worksheets[0].getCell('C9').value, '000229061234');
    assert.equal(exported.worksheets[0].getCell('E9').value.toISOString(), '2000-02-29T00:00:00.000Z');
    assert.equal(exported.worksheets[0].getCell('F9').value, 26);
    assert.equal(exported.worksheets[0].getCell('E10').value, null);
    if (process.env.FAM_EXPORT_PREVIEW && count === 51) writeFileSync(process.env.FAM_EXPORT_PREVIEW, serialized);
  }
  const historical = await buildFamClassOneWorkbook(template, [{ no_kp: '941231061234' }], 2025);
  assert.equal(historical.worksheets[0].getCell('F9').value, 31);

  // Exercise the actual button with the parent screen's filters and pagination.
  const uiFile = join(directory, 'ui.mjs');
  await build({ stdin: { contents: `
    import '@angular/compiler';
    export {createEnvironmentInjector,runInInjectionContext} from '@angular/core';
    export {AdminApplicationsComponent} from './src/app/features/admin/applications/applications.component';
    export {FamClassOneExportComponent} from './src/app/features/admin/applications/fam-class-one-export.component';
  `, resolveDir: frontend, loader: 'ts' }, outfile: uiFile, bundle: true, platform: 'node', format: 'esm',
  external: ['@angular/*', 'rxjs', 'rxjs/*'], tsconfig: join(frontend, 'tsconfig.json'),
  banner: { js: "import {createRequire as nodeRequire} from 'node:module'; const require = nodeRequire(import.meta.url);" } });
  const { createEnvironmentInjector, runInInjectionContext, AdminApplicationsComponent,
    FamClassOneExportComponent } = await import(pathToFileURL(uiFile));
  const injector = createEnvironmentInjector([]);
  const parent = new AdminApplicationsComponent({}, {}, {});
  parent.activeTab = 'kelas1'; parent.yearFilter = '2026'; parent.districtFilter = 'Pekan';
  parent.statusFilter = 'Menunggu'; parent.searchQuery = 'CALON';
  parent.applications = Array.from({ length: 14 }, (_, index) => ({
    nama_penuh: `CALON ${index + 1}`, no_kp: '000229061234', tahun_permohonan: 2026,
    district_nama: index === 12 ? 'Kuantan' : 'Pekan', status_ujian: index === 13 ? 'Lulus' : null,
  }));
  parent.applyFilter();
  assert.equal(parent.filtered.length, 12);
  assert.equal(parent.paged.length, 10);
  const button = runInInjectionContext(injector, () => new FamClassOneExportComponent());
  button.candidates = () => parent.filtered;
  button.year = () => parent.yearFilter;
  const saved = { fetch: globalThis.fetch, document: globalThis.document, setTimeout: globalThis.setTimeout,
    createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  const downloads = [], blobs = [], revoked = [], timers = [];
  try {
    globalThis.fetch = async () => new Response(template);
    globalThis.document = { createElement: () => { const link = { click: () => downloads.push(link.download) }; return link; } };
    globalThis.setTimeout = callback => { timers.push(callback); return 0; };
    URL.createObjectURL = blob => { blobs.push(blob); return 'blob:fam-export-test'; };
    URL.revokeObjectURL = url => revoked.push(url);
    await button.download();
    assert.deepEqual(downloads, ['Calon_Exam_Bolasepak_Kelas_1_FAM_Pahang_2026.xlsx']);
    const downloaded = new Workbook();
    await downloaded.xlsx.load(await blobs[0].arrayBuffer());
    assert.equal(downloaded.worksheets[0].getCell('B20').text, 'CALON 12', 'export includes the next list page');
    assert.equal(downloaded.worksheets[0].getCell('B21').text, '', 'PBD and status filters apply');
    assert.match(button.status(), /12 calon tahun 2026/);
    assert.equal(button.exporting(), false);
    timers.splice(0).forEach(callback => callback());
    assert.deepEqual(revoked, ['blob:fam-export-test']);

    globalThis.fetch = async () => new Response('', { status: 404 });
    await button.download();
    assert.match(button.error(), /Templat borang FAM tidak dapat dimuatkan/);
    assert.equal(downloads.length, 1, 'failed template download cannot export a partial file');
    assert.equal(button.exporting(), false);

    let release, fetches = 0;
    globalThis.fetch = () => { fetches++; return new Promise(resolve => { release = resolve; }); };
    const pending = button.download();
    await button.download();
    assert.equal(fetches, 1, 'double clicks cannot start duplicate exports');
    parent.yearFilter = '2025'; parent.filtered = [];
    release(new Response(template));
    await pending;
    assert.match(downloads[1], /2026/, 'in-flight download retains the year and candidate snapshot at click');
    await button.download();
    assert.equal(fetches, 1, 'empty lists cannot start an export');
  } finally {
    globalThis.fetch = saved.fetch; globalThis.document = saved.document; globalThis.setTimeout = saved.setTimeout;
    URL.createObjectURL = saved.createObjectURL; URL.revokeObjectURL = saved.revokeObjectURL;
    injector.destroy();
  }
  console.log('FAM Class I export: official template, 1/50/51/101 candidates, logo/style fidelity, MyKad dates, identifiers and empty fields passed.');
  console.log('FAM export button: real filters, all list pages, generated download, errors, double clicks and year snapshot passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

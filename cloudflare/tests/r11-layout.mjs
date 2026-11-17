import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderOriginalLocally } from './_harness.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/original-profile.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'refpahang-r11-layout-'));
try {
  for (const type of ['ujian_kelas1', 'ujian_bertulis', 'pengadil_futsal']) {
    const payload = { ...fixture, type, data: { ...fixture.data,
      district_nama: 'PERSATUAN BOLASEPAK DAERAH ROMPIN',
    } };
    const outputs = [['native', renderOriginalLocally(payload)]];
    if (process.env.ORIGINAL_RENDER_URL) {
      const response = await fetch(process.env.ORIGINAL_RENDER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, `${type}: edge renderer must succeed`);
      outputs.push(['worker', await response.json()]);
    }
    for (const [engine, result] of outputs) {
      const filename = join(directory, `${type}-${engine}.pdf`);
      assert.equal(result.mime, 'application/pdf');
      writeFileSync(filename, Buffer.from(result.base64, 'base64'));
      const info = execFileSync('pdfinfo', [filename], { encoding: 'utf8' });
      assert.equal(Number(info.match(/^Pages:\s+(\d+)/m)?.[1]), 1,
        `${type} (${engine}): the whole R11, including No. Pendaftaran, must fit on one A4 page`);
      assert.match(info, /Page size:.*A4/);
      const text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
      for (const label of ['MAKLUMAT PEMOHON', 'MAKLUMAT TEMPAT KERJA', 'MAKLUMAT WARIS TERDEKAT',
        'PENGAKUAN', 'Tandatangan pemohon', 'UNTUK KEGUNAAN PERSATUAN', 'No. Pendaftaran', fixture.data.nama_penuh]) {
        assert.ok(text.includes(label), `${type} (${engine}): retained ${label}`);
      }
      if (process.env.R11_PREVIEW_PATH && type === 'ujian_kelas1' && engine === 'native') {
        writeFileSync(process.env.R11_PREVIEW_PATH, Buffer.from(result.base64, 'base64'));
      }
    }
  }
  console.log('R11 layout: Class I, Class III and futsal are one A4 page with every section, signature and registration field retained.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

import { Workbook, type CellValue, type Worksheet } from 'exceljs';

export type MasterFieldType =
  | 'text'
  | 'id'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'money'
  | 'note';
export interface MasterColumn {
  key: string;
  label: string;
  type: MasterFieldType;
  width: number;
  section: string;
}
export interface MasterSheet {
  key: string;
  name: string;
  description: string;
  columns: MasterColumn[];
  rows: Record<string, string | number | null>[];
}
export interface UserMasterData {
  schema_version: number;
  year: number;
  exported_at: string;
  time_zone: string;
  source: string;
  sheets: MasterSheet[];
}

const ink = 'FF111827',
  yellow = 'FFFADA00';
const font = { name: 'Arial', size: 10, color: { argb: ink } };
const types: Record<MasterFieldType, string> = {
  text: 'Teks',
  id: 'ID (teks)',
  number: 'Nombor',
  date: 'Tarikh',
  datetime: 'Tarikh dan masa',
  boolean: 'Ya / Tidak',
  money: 'Amaun (RM)',
  note: 'Catatan',
};
const formats: Record<MasterFieldType, string> = {
  text: '@',
  id: '@',
  number: 'General',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm:ss',
  boolean: '[=1]"Ya";[=0]"Tidak";General',
  money: '#,##0.00',
  note: '@',
};

/** Excel has no timezone. Preserve source wall-clock values; only explicit zones are converted to Malaysia. */
export function masterDate(value: string): Date | string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      value,
    );
  if (!match) return value;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return value;
  const result = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    ),
  );
  if (
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day ||
    Number(match[4] || 0) > 23 ||
    Number(match[5] || 0) > 59 ||
    Number(match[6] || 0) > 59
  )
    return value;
  if (!match[7]) return result;
  const instant = new Date(value.replace(' ', 'T'));
  return Number.isFinite(instant.getTime()) ? new Date(instant.getTime() + 8 * 3600_000) : value;
}

export function masterCell(value: string | number | null, column: MasterColumn): CellValue {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && value.length > 32767)
    throw new Error(
      `Butiran "${column.label}" melebihi had satu sel Excel. Data tidak dipotong; eksport dibatalkan.`,
    );
  if (column.type === 'id' || column.type === 'text' || column.type === 'note')
    return String(value);
  if (column.type === 'date' || column.type === 'datetime') return masterDate(String(value));
  if (column.type === 'boolean') {
    if (value === 0 || value === '0') return 0;
    if (value === 1 || value === '1') return 1;
    return String(value);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
}

function baseSheet(
  workbook: Workbook,
  name: string,
  title: string,
  context: string,
  freeze = true,
): Worksheet {
  const sheet = workbook.addWorksheet(name, {
    properties: {
      defaultRowHeight: 20,
      tabColor: { argb: name === 'Master Pengguna' ? ink : 'FF64748B' },
    },
    views: [
      {
        state: freeze ? 'frozen' : 'normal',
        xSplit: freeze ? 3 : 0,
        ySplit: freeze ? 5 : 0,
        topLeftCell: freeze ? 'D6' : 'A1',
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: false,
      scale: 100,
      printTitlesRow: freeze ? '1:5' : undefined,
      printTitlesColumn: freeze ? 'A:C' : undefined,
    },
  });
  sheet.getCell('A2').value = title;
  sheet.getCell('A2').font = { ...font, bold: true, size: 14 };
  sheet.getRow(2).height = 26;
  for (let i = 1; i <= 10; i++)
    sheet.getCell(2, i).border = { bottom: { style: 'thin', color: { argb: yellow } } };
  sheet.getCell('A3').value = context;
  sheet.getCell('A3').font = { ...font, italic: true, color: { argb: 'FF475569' } };
  return sheet;
}

function styleHeader(sheet: Worksheet, row: number, count: number): void {
  sheet.getRow(row).height = 40;
  for (let index = 1; index <= count; index++) {
    const cell = sheet.getCell(row, index);
    cell.font = { ...font, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ink } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  }
}

function rowHeight(values: CellValue[], columns: MasterColumn[]): number {
  let lines = 1;
  values.forEach((value, index) => {
    if (typeof value !== 'string') return;
    const width = Math.max(10, columns[index].width - 3);
    const count = value
      .split(/\r?\n/)
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0);
    lines = Math.max(lines, count);
  });
  return Math.min(409, Math.max(20, lines * 14 + 6));
}

/** Also used by the file round-trip tests; no DOM access until the download component. */
export function buildUserMasterWorkbook(data: UserMasterData): Workbook {
  if (data.schema_version !== 1 || !data.sheets.length || data.sheets[0].key !== 'users')
    throw new Error('Format master data tidak dikenali.');
  const workbook = new Workbook();
  workbook.creator = 'RefPahang';
  workbook.lastModifiedBy = 'RefPahang';
  workbook.created = new Date(data.exported_at);
  workbook.modified = new Date(data.exported_at);
  const generated = new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(data.exported_at));
  const sheets = data.sheets.filter((sheet) => sheet.key === 'users' || sheet.rows.length > 0);
  for (const dataset of sheets) {
    const sheet = baseSheet(
      workbook,
      dataset.name,
      dataset.key === 'users' ? 'Master Data Pengguna' : dataset.name,
      `${dataset.rows.length.toLocaleString('ms-MY')} rekod. Dijana ${generated}. Tahun rujukan status ${data.year}.`,
    );
    sheet.columns = dataset.columns.map((column) => ({
      key: column.key,
      width: column.width,
      style: {
        font,
        numFmt: formats[column.type],
        alignment: {
          vertical: 'middle',
          horizontal: ['number', 'money'].includes(column.type) ? 'right' : 'left',
          wrapText: true,
        },
      },
    }));
    const rows = dataset.rows.map((row) =>
      dataset.columns.map((column) => masterCell(row[column.key], column)),
    );
    sheet.addTable({
      name: `Master_${dataset.key}`,
      ref: 'A5',
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium1', showRowStripes: true, showColumnStripes: false },
      columns: dataset.columns.map((column) => ({ name: column.label, filterButton: true })),
      rows,
    });
    styleHeader(sheet, 5, dataset.columns.length);
    rows.forEach((values, index) => {
      sheet.getRow(index + 6).height = rowHeight(values, dataset.columns);
    });
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(dataset.columns.length).letter}${Math.max(5, dataset.rows.length + 5)}`;
  }

  const guide = baseSheet(workbook, 'Panduan', 'Panduan Master Data', 'Portal RefPahang', false);
  guide.columns = [
    { width: 34, style: { font, alignment: { vertical: 'middle' } } },
    { width: 24, style: { font, alignment: { vertical: 'middle' } } },
    { width: 100, style: { font, alignment: { vertical: 'middle' } } },
  ];
  const metadata: [string, CellValue][] = [
    ['Tarikh dan masa jana', masterDate(data.exported_at)],
    ['Tahun rujukan status', data.year],
    [
      'Skop pengguna',
      'Semua akaun pengguna, termasuk akaun tidak aktif. Carian dan penapis skrin tidak mengehadkan eksport.',
    ],
    [
      'Sejarah',
      'Semua tahun permohonan, ujian, perlawanan, lantikan dan penilaian yang direkodkan.',
    ],
    [
      'Padanan antara helaian',
      'Gunakan ID Pengguna untuk memadankan rekod dengan Master Pengguna. ID rekod asal dikekalkan.',
    ],
    [
      'Tarikh dan masa rekod',
      'Nilai tanpa zon masa dikekalkan seperti rekod asal. Nilai dengan zon masa nyata ditukar kepada waktu Malaysia.',
    ],
    [
      'Nilai kosong',
      'Sel kosong bermaksud tiada nilai direkodkan. Sifar dikekalkan. IC, telefon, poskod dan ID disimpan sebagai teks.',
    ],
    [
      'Batas skop',
      'Akaun pengadil luar tanpa akaun pengguna, log teknikal, kata laluan, sesi dan token akses tidak termasuk.',
    ],
    [
      'Status tahunan',
      'Peranan, kelulusan pendaftaran, kehadiran seminar, keputusan kecergasan dan kelayakan lesen ialah butiran berasingan.',
    ],
  ];
  metadata.forEach(([label, value], index) => {
    guide.getCell(index + 5, 1).value = label;
    guide.getCell(index + 5, 1).font = { ...font, bold: true };
    guide.getCell(index + 5, 2).value = value;
    guide.getCell(index + 5, 2).alignment = { vertical: 'middle', wrapText: false };
  });
  guide.getCell('B5').numFmt = formats.datetime;
  guide.addTable({
    name: 'Kandungan_Master',
    ref: 'A16',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium1', showRowStripes: true },
    columns: [
      { name: 'Helaian', filterButton: true },
      { name: 'Jumlah Rekod', filterButton: true },
      { name: 'Butiran', filterButton: true },
    ],
    rows: data.sheets.map((sheet) => [
      sheet.name,
      sheet.rows.length,
      sheet.rows.length || sheet.key === 'users'
        ? sheet.description
        : 'Tiada rekod. Helaian ini tidak ditambah. ' + sheet.description,
    ]),
  });
  styleHeader(guide, 16, 3);
  data.sheets.forEach((_, index) => {
    guide.getRow(index + 17).height = 42;
    guide.getCell(index + 17, 3).alignment = { vertical: 'middle', wrapText: true };
  });

  const dictionary = baseSheet(
    workbook,
    'Kamus Medan',
    'Butiran Medan Master Data',
    'Jenis data dan kumpulan medan bagi setiap helaian.',
    false,
  );
  dictionary.views = [
    { state: 'frozen', ySplit: 5, xSplit: 1, topLeftCell: 'B6', showGridLines: false },
  ];
  dictionary.columns = [28, 30, 44, 24, 80].map((width) => ({ width, style: { font } }));
  dictionary.addTable({
    name: 'Medan_Master',
    ref: 'A5',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium1', showRowStripes: true },
    columns: ['Helaian', 'Kumpulan Butiran', 'Butiran Data', 'Jenis Data', 'Penerangan'].map(
      (name) => ({ name, filterButton: true }),
    ),
    rows: data.sheets.flatMap((sheet) =>
      sheet.columns.map((column) => [
        sheet.name,
        column.section,
        column.label,
        types[column.type],
        column.type === 'id'
          ? 'ID asal untuk padanan rekod; disimpan sebagai teks.'
          : column.type === 'boolean'
            ? '1 dipaparkan sebagai Ya, 0 sebagai Tidak; kosong jika tiada nilai.'
            : column.type === 'datetime' || column.type === 'date'
              ? 'Tarikh sah disimpan sebagai nilai Excel. Nilai asal yang tidak sah dikekalkan sebagai teks.'
              : column.type === 'money'
                ? 'Amaun dalam Ringgit Malaysia, dua tempat perpuluhan.'
                : column.key === 'umur'
                  ? 'Umur yang disimpan dalam rekod asal, bukan umur yang dikira semula.'
                  : sheet.description,
      ]),
    ),
  });
  styleHeader(dictionary, 5, 5);
  for (let row = 6; row <= dictionary.rowCount; row++) {
    dictionary.getRow(row).height = 36;
    dictionary.getRow(row).eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }
  workbook.views = [
    { x: 0, y: 0, width: 1440, height: 900, firstSheet: 0, activeTab: 0, visibility: 'visible' },
  ];
  return workbook;
}

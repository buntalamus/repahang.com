import { Workbook, type RowModel, type WorksheetModel } from 'exceljs';

export interface FamClassOneCandidate {
  nama_penuh?: string | null;
  no_kp?: string | null;
}

/** MyKad dates use the examination year, including the century and year-based age. */
export function candidateBirthDate(ic: string, year: number): Date | null {
  const digits = ic.replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(digits)) return null;
  const shortYear = Number(digits.slice(0, 2));
  let birthYear = Math.floor(year / 100) * 100 + shortYear;
  if (birthYear > year) birthYear -= 100;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const birthDate = new Date(Date.UTC(birthYear, month - 1, day));
  return birthDate.getUTCFullYear() === birthYear && birthDate.getUTCMonth() === month - 1
    && birthDate.getUTCDate() === day ? birthDate : null;
}

/** Fill the supplied FAM workbook, retaining its logo, styles and 50-candidate form. */
export async function buildFamClassOneWorkbook(
  template: ArrayBuffer,
  candidates: readonly FamClassOneCandidate[],
  year: number,
): Promise<Workbook> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Tahun peperiksaan tidak sah.');
  }
  if (!candidates.length) throw new Error('Tiada permohonan untuk dieksport mengikut penapis semasa.');
  const workbook = new Workbook();
  await workbook.xlsx.load(template);
  const source = workbook.worksheets[0];
  if (!source || source.getCell('B8').text !== 'Nama Calon'
      || source.getCell('G8').text !== 'T/tangan') {
    throw new Error('Templat borang FAM tidak sah.');
  }
  source.name = 'Pahang';
  // The source has hundreds of formatted empty rows beyond the actual form.
  const sourceModel = structuredClone(source.model) as WorksheetModel & { rows: RowModel[] };
  sourceModel.rows = sourceModel.rows.filter(row => row.number <= 64);
  for (const range of sourceModel.merges) source.unMergeCells(range);
  source.model = sourceModel;
  for (const range of sourceModel.merges) source.mergeCellsWithoutStyle(range);
  source.getCell('A3').value = `Peperiksaan Bertulis Pengadil Kelas 1 FAM  - ${year}`;
  source.getCell('B5').value = 'PB Negeri: PAHANG';
  for (let row = 9; row <= 58; row++) {
    for (let column = 1; column <= 7; column++) source.getCell(row, column).value = null;
    source.getCell(row, 1).value = row - 8;
  }
  // Keep the source's hidden date/age columns and original column widths.
  source.pageSetup = {
    ...source.pageSetup, printArea: 'A1:G64', paperSize: 9,
    orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: '8:8',
  };
  const blankForm = structuredClone(source.model);
  for (let offset = 0; offset < candidates.length; offset += 50) {
    const page = offset / 50 + 1;
    const sheet = offset === 0 ? source : workbook.addWorksheet(`Pahang ${page}`);
    if (offset !== 0) {
      sheet.model = { ...structuredClone(blankForm), id: sheet.id, name: sheet.name };
      // ExcelJS's model setter imports mergeCells, while its getter returns merges.
      for (const range of blankForm.merges) sheet.mergeCellsWithoutStyle(range);
    }
    for (let index = 0; index < 50; index++) sheet.getCell(index + 9, 1).value = offset + index + 1;
    candidates.slice(offset, offset + 50).forEach((candidate, index) => {
      const row = index + 9;
      const ic = String(candidate.no_kp ?? '').trim();
      const born = candidateBirthDate(ic, year);
      sheet.getCell(row, 1).value = offset + index + 1;
      // Explicit strings retain leading zeroes and cannot become Excel formulas.
      sheet.getCell(row, 2).value = String(candidate.nama_penuh ?? '').trim();
      sheet.getCell(row, 2).alignment = { ...sheet.getCell(row, 2).alignment, wrapText: true };
      sheet.getRow(row).height = Math.max(19.5,
        Math.ceil(sheet.getCell(row, 2).text.length / 36) * 15);
      sheet.getCell(row, 3).value = ic;
      sheet.getCell(row, 3).numFmt = '@';
      sheet.getCell(row, 5).value = born;
      sheet.getCell(row, 5).numFmt = 'dd/mm/yyyy';
      sheet.getCell(row, 6).value = born ? year - born.getUTCFullYear() : null;
      // Angka Giliran and T/tangan stay empty for FAM and the candidate.
    });
  }
  return workbook;
}

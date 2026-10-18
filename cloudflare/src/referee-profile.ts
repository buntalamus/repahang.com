import { profileYearLabels } from '../../shared/profile-fields';
export const profileLabels: Record<string, string> = {
  ...profileYearLabels, jenis_penilai: 'Jenis penilai', umur: 'Umur', aktif: 'Status akaun',
  alamat2: 'Alamat kediaman (baris 2)', alamat_majikan2: 'Alamat majikan (baris 2)',
  nama_penuh: 'Nama penuh', no_ic: 'No. Kad Pengenalan', email: 'Emel',
  no_telefon: 'No. telefon', jantina: 'Jantina', jenis_pengadil: 'Jenis pengadil',
  persatuan_id: 'Persatuan bola sepak', alamat1: 'Alamat kediaman',
  poskod: 'Poskod', daerah: 'Daerah', negeri: 'Negeri',
  status_kerja: 'Status pekerjaan', jawatan: 'Jawatan', nama_majikan: 'Nama majikan',
  alamat_majikan1: 'Alamat majikan', poskod_majikan: 'Poskod majikan',
  daerah_majikan: 'Daerah majikan', negeri_majikan: 'Negeri majikan',
  nama_waris: 'Nama waris', hubungan_waris: 'Hubungan waris',
  telefon_waris: 'No. telefon waris', saiz_baju: 'Saiz baju',
  tahun_mula_aktif: 'Tahun mula aktif', url_gambar_profil: 'Gambar profil',
};

const base = [
  'nama_penuh', 'no_ic', 'email', 'no_telefon', 'jantina', 'jenis_pengadil',
  'persatuan_id', 'alamat1', 'poskod', 'daerah', 'negeri', 'status_kerja',
  'nama_waris', 'hubungan_waris', 'telefon_waris', 'url_gambar_profil',
];
const employer = ['jawatan', 'nama_majikan', 'alamat_majikan1',
  'poskod_majikan', 'daerah_majikan', 'negeri_majikan'];

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function needsEmployerDetails(status: unknown): boolean {
  const value = String(status ?? '').trim().toUpperCase();
  return !!value && !['PELAJAR', 'TIDAK BEKERJA', 'PESARA'].includes(value);
}

export function missingRefereeProfile(profile: Record<string, unknown>): string[] {
  const fields = [...base];
  if (needsEmployerDetails(profile.status_kerja)) fields.push(...employer);
  if (profile.jenis_pengadil !== 'Penilai Pengadil' &&
      profile.jenis_pengadil !== 'Pegawai Pembangunan') {
    fields.push('saiz_baju', 'tahun_mula_aktif');
  }
  return fields.filter(key => !hasValue(profile[key]));
}

export interface User {
  id: number;
  email: string;
  password?: string;
  role: 'Admin' | 'PP Daerah' | 'Pengadil' | 'Penilai';
  district_id?: number | null;
  persatuan_id: number | null;
  persatuan_nama?: string | null;
  nama_penuh: string;
  no_ic?: string;
  no_telefon?: string;
  alamat1?: string;
  alamat2?: string;
  poskod?: string;
  daerah?: string;
  negeri?: string;
  status_kerja?: string;
  jawatan?: string;
  nama_majikan?: string;
  alamat_majikan1?: string;
  alamat_majikan2?: string;
  poskod_majikan?: string;
  daerah_majikan?: string;
  negeri_majikan?: string;
  nama_waris?: string;
  hubungan_waris?: string;
  telefon_waris?: string;
  url_gambar_profil?: string | null;
  jantina?: 'Lelaki' | 'Perempuan' | '';
  jenis_pengadil?: string;
  jenis_penilai?: string;
  tahun_mula_aktif?: number | null;
  saiz_baju?: string;
  aktif?: number;
  password_changed: number;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
  umur?: number | null;
}

export interface Permohonan {
  id: number;
  user_id: number;
  district_id: number | null;
  persatuan_id: number | null;
  tahun_permohonan: number;
  jenis_permohonan: 'pendaftaran_pengadil' | 'ujian_kecergasan';
  jenis_borang: 'pengadil_berdaftar' | 'ujian_kecergasan' | 'pengadil_futsal';
  nama_penuh: string;
  no_kp: string;
  emel: string;
  no_telefon: string;
  jantina: string;
  jenis_pengadil: string;
  persatuan_daerah: string;
  saiz_baju: string;
  tahun_mula_aktif: number | null;
  alamat1: string;
  alamat2: string;
  poskod: string;
  daerah: string;
  negeri: string;
  status_kerja: string;
  jawatan: string;
  nama_majikan: string;
  alamat_majikan1: string;
  alamat_majikan2: string;
  poskod_majikan: string;
  daerah_majikan: string;
  negeri_majikan: string;
  nama_waris: string;
  hubungan_waris: string;
  telefon_waris: string;
  url_resit: string | null;
  url_gambar_profil: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  status_workflow:
    | 'Draf'
    | 'Menunggu PP Daerah'
    | 'PP Daerah Disahkan'
    | 'Menunggu Admin'
    | 'Admin Diluluskan'
    | 'Menunggu Bayaran'
    | 'Bayaran Diterima'
    | 'Lengkap'
    | 'Ditolak';
  pp_verified_at: string | null;
  pp_verified_by: number | null;
  pp_notes: string | null;
  admin_approved_at: string | null;
  admin_approved_by: number | null;
  admin_notes: string | null;
  payment_receipt_url: string | null;
  payment_amount: number;
  payment_verified_at: string | null;
  final_approved_at: string | null;
  tarikh_hantar: string | null;
  mohon_r1: number;
  mohon_r2: number;
  mohon_ujian_bertulis: number;
  mohon_ujian_kecergasan: number;
  declare1: number;
  declare2: number;
  declare3: number;
  declare4: number;
  declare5: number;
  umur: number | null;
  tarikh_lahir: string | null;
  tempat_lahir: string | null;
  status_ujian: 'Lulus' | 'Tidak Lulus' | 'Tidak Hadir' | null;
  created_at?: string;
  updated_at?: string;
}

export interface Perlawanan {
  id: number;
  user_id: number;
  permohonan_id: number | null;
  status_pp: 'Belum Disahkan' | 'Disahkan' | 'Tidak Disahkan';
  verified_by: number | null;
  verified_at: string | null;
  catatan_pp: string | null;
  district_id: number | null;
  persatuan_id: number | null;
  tarikh: string;
  jenis: string;
  tempat: string;
  home_team: string;
  away_team: string;
  head_referee_id: number | null;
  assistant_referee_1_id: number | null;
  assistant_referee_2_id: number | null;
  fourth_official_id: number | null;
  jawatan: string;
  created_at: string;
}

export interface Penilaian {
  id: number;
  perlawanan_id: number;
  pengadil_id: number;
  penilai_id: number;
  skor_pengetahuan: number;
  skor_kedudukan: number;
  skor_keputusan: number;
  skor_kerjasama: number;
  skor_penampilan: number;
  jumlah_skor: number;
  catatan: string | null;
  score_teknikal: number | null;
  score_fizikal: number | null;
  score_mental: number | null;
  score_disiplin: number | null;
  status_penilaian: 'pending' | 'completed';
  komen_penilai: string | null;
  tarikh_penilaian: string | null;
}

export interface PersatuanDaerah {
  id: number;
  nama_persatuan: string;
  kod_persatuan: string;
  daerah: string;
  alamat_penuh: string | null;
  pegawai_pengarah: string | null;
  no_telefon: string | null;
  emel: string | null;
  aktif: number;
}

export interface LoginResponse {
  error: boolean;
  message: string;
  data?: User & { redirect_url: string };
}

export interface SessionResponse {
  authenticated: boolean;
  user_id?: number;
  user_email?: string;
  user_role?: string;
  user_persatuan_id?: number;
  user_persatuan_name?: string;
  nama_penuh?: string;
  password_changed?: number;
  base_url?: string;
}

export interface ApiResponse<T = unknown> {
  error: boolean;
  message: string;
  data?: T;
}

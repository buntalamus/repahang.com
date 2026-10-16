/** Explicit business-field allowlist. Authentication secrets never enter export queries. */
export type MasterCell = string | number | null;
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
export interface MasterDataset {
  key: string;
  name: string;
  description: string;
  columns: MasterColumn[];
  from: string;
  alias: string;
  where?: string;
}

function fields(section: string, specification: string): MasterColumn[] {
  return specification
    .trim()
    .split('\n')
    .map((line) => {
      const [key, label, type = 'text', width = '24'] = line.trim().split('|');
      return { key, label, type: type as MasterFieldType, width: Number(width), section };
    });
}
const record = fields(
  'Identiti rekod',
  `id|ID Rekod|id|14
user_id|ID Pengguna|id|14
nama_pengguna|Nama Pengguna|text|36
emel_pengguna|Emel Pengguna|text|34`,
);
const residence = fields(
  'Alamat kediaman',
  `alamat1|Alamat 1|text|40
alamat2|Alamat 2|text|40
poskod|Poskod|text|12
daerah|Daerah Kediaman|text|24
negeri|Negeri Kediaman|text|24`,
);
const employment = fields(
  'Pekerjaan',
  `status_kerja|Status Pekerjaan|text|22
jawatan|Jawatan Pekerjaan|text|32
nama_majikan|Nama Majikan|text|36
alamat_majikan1|Alamat Majikan 1|text|40
alamat_majikan2|Alamat Majikan 2|text|40
poskod_majikan|Poskod Majikan|text|16
daerah_majikan|Daerah Majikan|text|24
negeri_majikan|Negeri Majikan|text|24`,
);
const family = fields(
  'Waris',
  `nama_waris|Nama Waris|text|36
hubungan_waris|Hubungan Waris|text|22
telefon_waris|Telefon Waris|text|20`,
);
const referee = fields(
  'Kelayakan dan pakaian',
  `jenis_pengadil|Jenis Pengadil|text|25
saiz_baju|Saiz Baju|text|14
tahun_mula_aktif|Tahun Mula Aktif|number|18`,
);
const assessmentNotes = fields(
  'Ulasan penilaian',
  `kawalan_kekuatan|Kawalan - Kekuatan|note|48
kawalan_kelemahan|Kawalan - Kelemahan|note|48
kawalan_nasihat|Kawalan - Nasihat|note|48
fizikal_kekuatan|Fizikal - Kekuatan|note|48
fizikal_kelemahan|Fizikal - Kelemahan|note|48
fizikal_nasihat|Fizikal - Nasihat|note|48
kerjasama_kekuatan|Kerjasama - Kekuatan|note|48
kerjasama_kelemahan|Kerjasama - Kelemahan|note|48
kerjasama_nasihat|Kerjasama - Nasihat|note|48`,
);
const scores = fields(
  'Keputusan perlawanan',
  `skor_ht_home|Separuh Masa - Tuan Rumah|number|22
skor_ht_away|Separuh Masa - Pelawat|number|22
skor_ft_home|Masa Penuh - Tuan Rumah|number|22
skor_ft_away|Masa Penuh - Pelawat|number|22
skor_et_home|Masa Tambahan - Tuan Rumah|number|22
skor_et_away|Masa Tambahan - Pelawat|number|22
skor_ps_home|Penalti - Tuan Rumah|number|22
skor_ps_away|Penalti - Pelawat|number|22
cuaca|Cuaca|text|22`,
);
const matchContext = fields(
  'Perlawanan lantikan',
  `jadual_id|ID Jadual|id|14
nama_kejohanan|Nama Kejohanan|text|44
no_perlawanan|No. Perlawanan|text|18
tarikh_perlawanan|Tarikh Perlawanan|date|20
masa_perlawanan|Masa Perlawanan|text|18
pasukan_home|Pasukan Tuan Rumah|text|32
pasukan_away|Pasukan Pelawat|text|32
tempat_perlawanan|Tempat Perlawanan|text|36`,
);
const matchJoin = `LEFT JOIN jadual_perlawanan j ON j.id=x.jadual_id LEFT JOIN kejohanan k ON k.id=j.kejohanan_id`;

export const USER_COLUMNS: MasterColumn[] = [
  ...fields(
    'Identiti pengguna',
    `id|ID Pengguna|id|14
nama_penuh|Nama Penuh|text|38
email|Emel|text|34
no_ic|No. Kad Pengenalan|text|22
no_telefon|No. Telefon|text|20
jantina|Jantina|text|16
umur|Umur Direkodkan|number|18
role|Peranan Sistem|text|32
aktif|Akaun Aktif|boolean|16`,
  ),
  ...fields(
    'Pentadbiran',
    `district_id|ID Daerah Pentadbiran|id|22
nama_daerah_pentadbiran|Daerah Pentadbiran|text|25
persatuan_id|ID Persatuan|id|16
nama_persatuan|Persatuan Bola Sepak Daerah|text|42
kod_persatuan|Kod Persatuan|text|18
daerah_persatuan|Daerah Persatuan|text|24`,
  ),
  ...referee,
  ...fields(
    'Kelayakan pengadil',
    `jenis_penilai|Jenis Penilai|text|25
tahun_mohon_kelas3|Tahun Mohon Kelas III|number|22
tahun_lulus_kelas3|Tahun Lulus Kelas III|number|22
pengadil_kebangsaan|Pengadil Kebangsaan|boolean|22
pengadil_negeri|Pengadil Negeri|boolean|20
pengadil_daerah|Pengadil Daerah|boolean|20`,
  ),
  ...residence,
  ...employment,
  ...family,
  ...fields(
    'Hubungan dan rekod akaun',
    `telegram_chat_id|ID Telegram|text|24
url_gambar_profil|Rujukan Gambar Profil|text|46
last_login|Log Masuk Terakhir|datetime|24
created_at|Tarikh Akaun Dicipta|datetime|24
updated_at|Tarikh Profil Dikemaskini|datetime|26`,
  ),
];
export const ANNUAL_COLUMNS = fields(
  'Status bagi tahun rujukan',
  `tahun_rujukan|Tahun Rujukan Status|number|22
is_referee|Mempunyai Peranan Pengadil|boolean|26
is_ra|Mempunyai Peranan RA|boolean|26
status_pendaftaran|Status Pendaftaran Pengadil|text|32
current_applied|Memohon Tahun Rujukan|boolean|24
current_approved|Diluluskan Tahun Rujukan|boolean|26
prior_approved|Pernah Diluluskan Sebelum Tahun Rujukan|boolean|34
current_fitness_status|Keputusan Kecergasan Tahun Rujukan|text|32
current_license|Layak Patch atau Lesen Tahun Rujukan|boolean|34
class3_passed|Lulus Kelas III FAM|boolean|24
class1_passed|Lulus Kelas I FAM|boolean|24`,
);

const applications = [
  ...record,
  ...fields(
    'Permohonan',
    `district_id|ID Daerah Pentadbiran|id|22
persatuan_id|ID Persatuan Permohonan|id|24
tahun_permohonan|Tahun Permohonan|number|20
jenis_permohonan|Jenis Permohonan|text|28
jenis_borang|Jenis Borang|text|28
nama_penuh|Nama Dalam Permohonan|text|38
no_kp|No. Kad Pengenalan Permohonan|text|28
emel|Emel Dalam Permohonan|text|34
no_telefon|Telefon Dalam Permohonan|text|24
jantina|Jantina|text|16
persatuan_daerah|Persatuan Dalam Permohonan|text|42`,
  ),
  ...referee,
  ...residence,
  ...employment,
  ...family,
  ...fields(
    'Dokumen',
    `url_resit|Rujukan Resit|text|46
url_gambar_profil|Rujukan Gambar Profil|text|46
payment_receipt_url|Rujukan Resit Bayaran|text|46
payment_amount|Amaun Bayaran (RM)|money|22
payment_verified_at|Tarikh Bayaran Disahkan|datetime|26`,
  ),
  ...fields(
    'Status dan semakan',
    `status|Status Permohonan|text|24
status_workflow|Status Proses|text|28
workflow_status|Status Proses Lama|text|28
status_kemaskini|Status Kemaskini|text|24
status_ujian|Keputusan Ujian|text|24
status_seminar|Kehadiran Seminar|text|24
pp_verified_at|Tarikh Disahkan PP|datetime|24
pp_verified_by|ID PP Yang Mengesahkan|id|24
pp_notes|Catatan PP|note|48
admin_approved_at|Tarikh Diluluskan Admin|datetime|26
admin_approved_by|ID Admin Pelulus|id|22
admin_notes|Catatan Admin|note|48
final_approved_at|Tarikh Kelulusan Akhir|datetime|26
tarikh_hantar|Tarikh Dihantar|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
  ),
  ...fields(
    'Pilihan dan pengakuan',
    `mohon_r1|Mohon R1|boolean|16
mohon_r2|Mohon R2|boolean|16
mohon_ujian_bertulis|Mohon Ujian Bertulis|boolean|24
mohon_ujian_kecergasan|Mohon Ujian Kecergasan|boolean|24
declare1|Pengakuan 1|boolean|18
declare2|Pengakuan 2|boolean|18
declare3|Pengakuan 3|boolean|18
declare4|Pengakuan 4|boolean|18
declare5|Pengakuan 5|boolean|18
umur|Umur Dalam Permohonan|number|24
tarikh_lahir|Tarikh Lahir|date|18
tempat_lahir|Tempat Lahir|text|32`,
  ),
];
const legacyProfile = [
  ...fields(
    'Butiran permohonan lama',
    `persatuan_id|ID Persatuan|id|18
nama_penuh|Nama Dalam Permohonan|text|38
no_ic|No. Kad Pengenalan|text|24
email|Emel Dalam Permohonan|text|34
no_telefon|No. Telefon|text|20
jantina|Jantina|text|16
tarikh_lahir|Tarikh Lahir|date|18
alamat|Alamat Penuh Lama|text|48
status|Status Permohonan|text|24
created_at|Tarikh Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
  ),
];

export const MASTER_DATASETS: MasterDataset[] = [
  {
    key: 'applications',
    name: 'Pendaftaran',
    description:
      'Satu baris setiap permohonan, semua tahun dan semua status. Butiran ialah salinan semasa permohonan dibuat.',
    columns: applications,
    alias: 'x',
    from: 'permohonan x LEFT JOIN users u ON u.id=x.user_id',
  },
  {
    key: 'pp_applications',
    name: 'Permohonan PP',
    description: 'Satu baris setiap permohonan Pegawai Pembangunan Daerah dalam rekod asal.',
    columns: [
      ...record,
      ...legacyProfile,
      ...referee,
      ...residence,
      ...employment,
      ...family,
      ...fields(
        'Butiran PP',
        `jenis_permohonan|Jenis Permohonan|text|28
resit_pembayaran_path|Rujukan Resit Pembayaran|text|46
resit_path|Rujukan Resit Lama|text|46
approved_at|Tarikh Kelulusan|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'permohonan_pp x LEFT JOIN users u ON u.id=x.user_id',
  },
  {
    key: 'written_legacy',
    name: 'Ujian Bertulis Lama',
    description: 'Permohonan ujian bertulis yang disimpan berasingan dalam rekod lama.',
    columns: [
      ...record,
      ...legacyProfile,
      ...fields(
        'Ujian bertulis',
        `umur|Umur Direkodkan|number|18
status_kerja|Status Pekerjaan|text|24
jawatan|Jawatan Pekerjaan|text|32
nama_majikan|Nama Majikan|text|36
jenis_pengadil|Jenis Pengadil|text|26
tempat_lahir|Tempat Lahir|text|32
status_workflow|Status Proses|text|26
tahun_permohonan|Tahun Permohonan|number|22`,
      ),
    ],
    alias: 'x',
    from: 'permohonan_ujian_bertulis x LEFT JOIN users u ON u.id=x.user_id',
  },
  {
    key: 'fitness_legacy',
    name: 'Ujian Kecergasan Lama',
    description: 'Permohonan ujian kecergasan yang disimpan berasingan dalam rekod lama.',
    columns: [
      ...record,
      ...legacyProfile,
      ...family,
      ...fields(
        'Ujian kecergasan',
        `jenis_permohonan|Jenis Permohonan|text|28
declare1|Pengakuan 1|boolean|18
declare2|Pengakuan 2|boolean|18
declare3|Pengakuan 3|boolean|18
declare4|Pengakuan 4|boolean|18
declare5|Pengakuan 5|boolean|18
umur|Umur Direkodkan|number|18
status_kerja|Status Pekerjaan|text|24
jawatan|Jawatan Pekerjaan|text|32
nama_majikan|Nama Majikan|text|36
jenis_pengadil|Jenis Pengadil|text|26
tempat_lahir|Tempat Lahir|text|32
workflow_status|Status Proses|text|26
tahun_permohonan|Tahun Permohonan|number|22`,
      ),
    ],
    alias: 'x',
    from: 'permohonan_ujian_kecergasan x LEFT JOIN users u ON u.id=x.user_id',
  },
  {
    key: 'assessor_applications',
    name: 'Butiran Penilai',
    description:
      'Kelayakan tambahan bagi permohonan Penilai Pengadil, dipautkan melalui ID Permohonan.',
    columns: [
      ...record,
      ...fields(
        'Kelayakan penilai',
        `permohonan_id|ID Permohonan|id|18
jenis_penilai|Jenis Penilai|text|28
tahun_pengalaman|Tahun Pengalaman|number|22
kelayakan|Kelayakan|note|48
sijil_kursus_url|Rujukan Sijil Kursus|text|46
sijil_kesihatan_url|Rujukan Sijil Kesihatan|text|46
catatan|Catatan|note|48
created_at|Tarikh Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'penilai_permohonan x LEFT JOIN permohonan a ON a.id=x.permohonan_id LEFT JOIN users u ON u.id=a.user_id',
  },
  {
    key: 'matches',
    name: 'Rekod Perlawanan',
    description:
      'Satu baris setiap rekod perlawanan asal. Rekod pengguna yang berlainan bagi perlawanan yang sama dikekalkan.',
    columns: [
      ...record,
      ...fields(
        'Pemilikan dan semakan',
        `match_group_id|ID Kumpulan Perlawanan|id|24
submitted_by|ID Penghantar Rekod|id|22
lantikan_id|ID Lantikan|id|16
permohonan_id|ID Permohonan|id|18
status_pp|Status Semakan PP|text|24
verified_by|ID Pegawai Penyemak|id|22
verified_at|Tarikh Disemak|datetime|24
catatan_pp|Catatan PP|note|48
district_id|ID Daerah Pentadbiran|id|24
persatuan_id|ID Persatuan|id|18
daerah_perlawanan_id|ID Daerah Perlawanan|id|24`,
      ),
      ...fields(
        'Butiran perlawanan',
        `tarikh|Tarikh Perlawanan|date|20
masa|Masa Perlawanan|text|18
jenis|Jenis Perlawanan|text|28
nama_kejohanan|Nama Kejohanan|text|44
tempat|Tempat Perlawanan|text|36
home_team|Pasukan Tuan Rumah|text|32
away_team|Pasukan Pelawat|text|32
jawatan|Jawatan Perlawanan|text|24`,
      ),
      ...scores,
      ...fields(
        'Krew perlawanan',
        `head_referee_id|ID Pengadil Utama|id|22
assistant_referee_1_id|ID Penolong Pengadil 1|id|24
assistant_referee_2_id|ID Penolong Pengadil 2|id|24
fourth_official_id|ID Pegawai Keempat|id|22
created_at|Tarikh Rekod Dicipta|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'perlawanan x LEFT JOIN users u ON u.id=x.user_id',
  },
  {
    key: 'appointments',
    name: 'Lantikan',
    description:
      'Satu baris setiap lantikan akaun pengguna. Lantikan pengadil luar tanpa akaun pengguna tidak termasuk.',
    columns: [
      ...record,
      ...matchContext,
      ...fields(
        'Lantikan',
        `pengadil_id|ID Pengadil Dilantik|id|22
pengadil_luar_id|ID Pengadil Luar|id|20
jawatan|Jawatan Lantikan|text|24
status|Status Lantikan|text|24
komen|Komen Jawapan|note|48
sebab_status|Sebab Status|note|48
tarikh_jawab|Tarikh Jawapan|datetime|24
status_dikemaskini_at|Tarikh Status Dikemaskini|datetime|28
notif_hantar|Notifikasi Emel Dihantar|boolean|26
tg_notif_hantar|Notifikasi Telegram Dihantar|boolean|28
tarikh_notif|Tarikh Notifikasi|datetime|24
created_by|ID Pembuat Lantikan|id|22
created_at|Tarikh Lantikan Dicipta|datetime|26
updated_at|Tarikh Dikemaskini|datetime|24`,
      ),
    ],
    alias: 'x',
    from: `lantikan_pengadil x LEFT JOIN users u ON u.id=x.pengadil_id ${matchJoin}`,
    where: 'x.pengadil_id IS NOT NULL',
  },
  {
    key: 'pool',
    name: 'Pool Kejohanan',
    description: 'Satu baris setiap penyertaan pengguna dalam pool kejohanan.',
    columns: [
      ...record,
      ...fields(
        'Pool kejohanan',
        `kejohanan_id|ID Kejohanan|id|18
nama_kejohanan|Nama Kejohanan|text|44
pengadil_id|ID Pengadil|id|18
created_at|Tarikh Ditambah|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'pool_pengadil x LEFT JOIN users u ON u.id=x.pengadil_id LEFT JOIN kejohanan k ON k.id=x.kejohanan_id',
    where: 'x.pengadil_id IS NOT NULL',
  },
  {
    key: 'reports',
    name: 'Laporan RA',
    description:
      'Satu baris setiap laporan RA. ID Pengguna merujuk kepada Penilai Pengadil yang menyediakan laporan.',
    columns: [
      ...record,
      ...matchContext,
      ...fields(
        'Identiti laporan',
        `lantikan_id|ID Lantikan|id|18
penilai_id|ID Penilai Pengadil|id|22
pengadil_id|ID Pengadil Rekod Utama|id|26
markah|Markah Rekod Utama|number|22
tahap_kesukaran|Tahap Kesukaran|text|24`,
      ),
      ...scores,
      ...assessmentNotes,
      ...fields(
        'Status laporan',
        `ulasan_keseluruhan|Ulasan Keseluruhan|note|54
prestasi|Prestasi|text|24
status|Status Laporan|text|24
tarikh_hantar|Tarikh Dihantar|datetime|24
catatan_admin|Catatan Admin|note|48
tarikh_sahkan|Tarikh Disahkan|datetime|24
created_at|Tarikh Laporan Dicipta|datetime|26
updated_at|Tarikh Dikemaskini|datetime|24`,
      ),
    ],
    alias: 'x',
    from: `laporan_penilaian x LEFT JOIN users u ON u.id=x.penilai_id ${matchJoin}`,
  },
  {
    key: 'report_officials',
    name: 'Markah Pegawai',
    description:
      'Satu baris setiap pegawai dalam laporan RA. ID Pengguna merujuk kepada pegawai dinilai; pegawai luar boleh tiada ID Pengguna.',
    columns: [
      ...record,
      ...fields(
        'Penilaian pegawai',
        `laporan_id|ID Laporan RA|id|18
lantikan_pengadil_id|ID Lantikan Pegawai|id|22
penilai_id|ID Penilai Pengadil|id|22
nama_penilai|Nama Penilai Pengadil|text|38
nama_pengadil|Nama Pegawai Dalam Laporan|text|38
jawatan|Jawatan Pegawai|text|24
markah|Markah|number|16
prestasi|Prestasi|text|24`,
      ),
      ...assessmentNotes,
      ...fields('Rekod', 'created_at|Tarikh Rekod Dicipta|datetime|24'),
    ],
    alias: 'x',
    from: 'laporan_penilaian_pegawai x LEFT JOIN lantikan_pengadil l ON l.id=x.lantikan_pengadil_id LEFT JOIN users u ON u.id=l.pengadil_id LEFT JOIN laporan_penilaian r ON r.id=x.laporan_id LEFT JOIN users ra ON ra.id=r.penilai_id',
  },
  {
    key: 'report_approvals',
    name: 'Pengesahan Laporan',
    description:
      'Satu baris setiap pengesahan pengerusi. ID Pengguna merujuk kepada pengesah laporan.',
    columns: [
      ...record,
      ...fields(
        'Pengesahan pengerusi',
        `laporan_id|ID Laporan RA|id|18
kejohanan_pengesah_id|ID Pengesah Kejohanan|id|24
pengesah_user_id|ID Akaun Pengesah|id|22
pengesah_luar_id|ID Pengesah Luar|id|22
pengesah_nama|Nama Pengesah Dalam Rekod|text|38
pengesah_jawatan|Jawatan Pengesah|text|32
pengesah_negeri|Negeri Pengesah|text|24
status|Status Pengesahan|text|24
email_recipient|Emel Penerima Pengesahan|text|36
catatan_pengerusi|Catatan Pengerusi|note|54
tarikh_sahkan|Tarikh Disahkan|datetime|24
admin_override_user_id|ID Admin Kelulusan Khas|id|26
alasan_override|Alasan Kelulusan Khas|note|48
created_at|Tarikh Rekod Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'laporan_pengesahan_pengerusi x LEFT JOIN users u ON u.id=x.pengesah_user_id',
  },
  {
    key: 'tournament_approvers',
    name: 'Pengesah Kejohanan',
    description:
      'Pelantikan pengguna sebagai pengesah laporan kejohanan. Pengesah luar turut disimpan apabila berkaitan.',
    columns: [
      ...record,
      ...fields(
        'Pelantikan pengesah',
        `kejohanan_id|ID Kejohanan|id|18
nama_kejohanan|Nama Kejohanan|text|44
pengesah_user_id|ID Akaun Pengesah|id|22
pengesah_luar_id|ID Pengesah Luar|id|22
nama_snapshot|Nama Semasa Dilantik|text|38
jawatan_snapshot|Jawatan Semasa Dilantik|text|32
peringkat_snapshot|Peringkat Semasa Dilantik|text|28
aktif|Pelantikan Aktif|boolean|20
created_by|ID Pembuat Pelantikan|id|24
created_at|Tarikh Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
      ),
    ],
    alias: 'x',
    from: 'kejohanan_pengesah_laporan x LEFT JOIN users u ON u.id=x.pengesah_user_id LEFT JOIN kejohanan k ON k.id=x.kejohanan_id',
  },
];

// Preserve older assessment and participation sources if populated, without inventing rows.
for (const [table, name, extra] of [
  [
    'penilaian',
    'Penilaian Lama',
    `skor_pengetahuan|Skor Pengetahuan|number|22
skor_kedudukan|Skor Kedudukan|number|22
skor_keputusan|Skor Keputusan|number|22
skor_kerjasama|Skor Kerjasama|number|22
skor_penampilan|Skor Penampilan|number|22
jumlah_skor|Jumlah Skor|number|20
catatan|Catatan|note|48
created_at|Tarikh Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24
score_teknikal|Skor Teknikal Lama|number|22
score_fizikal|Skor Fizikal Lama|number|22
score_mental|Skor Mental Lama|number|22
score_disiplin|Skor Disiplin Lama|number|22
status_penilaian|Status Penilaian|text|24
komen_penilai|Komen Penilai|note|48
tarikh_penilaian|Tarikh Penilaian|datetime|24`,
  ],
  [
    'penilaian_pengadil',
    'Penilaian Pengadil Lama',
    `skor_pengetahuan|Skor Pengetahuan|number|22
skor_kedudukan|Skor Kedudukan|number|22
skor_keputusan|Skor Keputusan|number|22
skor_kerjasama|Skor Kerjasama|number|22
skor_penampilan|Skor Penampilan|number|22
nilai|Nilai Penilaian|number|22
catatan|Catatan|note|48
tarikh_penilaian|Tarikh Penilaian|datetime|24`,
  ],
] as const) {
  MASTER_DATASETS.push({
    key: table,
    name,
    description: 'Penilaian dalam rekod lama, dikekalkan berasingan daripada laporan RA semasa.',
    columns: [
      ...record,
      ...fields(
        'Penilaian lama',
        `perlawanan_id|ID Perlawanan|id|20
pengadil_id|ID Pengadil|id|18
penilai_id|ID Penilai|id|18
${extra}`,
      ),
    ],
    alias: 'x',
    from: `${table} x LEFT JOIN users u ON u.id=x.pengadil_id`,
  });
}
MASTER_DATASETS.push({
  key: 'legacy_match_officials',
  name: 'Krew Perlawanan Lama',
  description: 'Penyertaan pengadil dalam rekod perlawanan lama.',
  alias: 'x',
  from: 'perlawanan_pengadil x LEFT JOIN users u ON u.id=x.pengadil_id',
  columns: [
    ...record,
    ...fields(
      'Krew perlawanan lama',
      `perlawanan_id|ID Perlawanan|id|20
pengadil_id|ID Pengadil|id|18
status_pp|Status Semakan PP|text|24
status_pengadil|Status Jawapan Pengadil|text|26
komen_pengadil|Komen Pengadil|note|48
tarikh_jawab|Tarikh Jawapan|datetime|24
catatan_pp|Catatan PP|note|48
created_at|Tarikh Dicipta|datetime|24
updated_at|Tarikh Dikemaskini|datetime|24`,
    ),
  ],
});

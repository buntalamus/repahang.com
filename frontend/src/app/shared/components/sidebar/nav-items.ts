export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
  { label: 'Permohonan Pengadil', icon: 'description', route: '/admin/permohonan' },
  { label: 'Permohonan RA', icon: 'rate_review', route: '/admin/permohonan-ra' },
  { label: 'Pengadil Berdaftar', icon: 'people', route: '/admin/pengadil-berdaftar' },
  { label: 'RA Berdaftar', icon: 'rate_review', route: '/admin/ra-berdaftar' },
  { label: 'PP Daerah', icon: 'admin_panel_settings', route: '/admin/pp-daerah' },
  { label: 'Pengguna', icon: 'group', route: '/admin/pengguna' },
  { label: 'Lantikan Pengadil', icon: 'assignment_ind', route: '/admin/lantikan' },
  { label: 'Rekod Perlawanan', icon: 'sports_soccer', route: '/admin/perlawanan' },
  { label: 'Pengadil Luar', icon: 'person_add', route: '/admin/pengadil-luar' },
  { label: 'Statistik', icon: 'bar_chart', route: '/admin/statistik' },
  { label: 'Pengumuman', icon: 'campaign', route: '/admin/pengumuman' },
  { label: 'Tetapan', icon: 'settings', route: '/admin/tetapan' },
  { label: 'Profil Saya', icon: 'person', route: '/admin/profil' },
];

export const PP_DAERAH_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/pp-daerah' },
  {
    label: 'Permohonan Saya',
    icon: 'how_to_reg',
    children: [
      { label: 'Pendaftaran Tahunan Penilai (R4)', icon: 'badge', route: '/pp-daerah/daftar/tahunan' },
      { label: 'Kelas III FAM', icon: 'quiz', route: '/pp-daerah/daftar/kelas3' },
      { label: 'Ujian Kelas I FAM', icon: 'military_tech', route: '/pp-daerah/daftar/kelas1' },
    ],
  },
  { label: 'Pengesahan Permohonan', icon: 'verified', route: '/pp-daerah/pengesahan' },
  { label: 'Pengesahan Perlawanan', icon: 'sports_soccer', route: '/pp-daerah/pengesahan-perlawanan' },
  {
    label: 'Permohonan',
    icon: 'description',
    children: [
      { label: 'Pengadil Berdaftar', icon: 'badge', route: '/pp-daerah/permohonan/pengadil' },
      { label: 'RA Berdaftar', icon: 'rate_review', route: '/pp-daerah/permohonan/berdaftar' },
      { label: 'Kelas III FAM', icon: 'quiz', route: '/pp-daerah/permohonan/kelas3' },
      { label: 'Ujian Kelas I FAM', icon: 'military_tech', route: '/pp-daerah/permohonan/kelas1' },
    ],
  },
  { label: 'Pengadil Berdaftar', icon: 'people', route: '/pp-daerah/pengadil' },
  { label: 'RA Berdaftar', icon: 'rate_review', route: '/pp-daerah/ra-berdaftar' },
  { label: 'Laporan Penilaian', icon: 'assessment', route: '/pp-daerah/laporan-penilaian' },
  { label: 'Tugasan Lantikan', icon: 'assignment_ind', route: '/pp-daerah/tugasan' },
  { label: 'Profil', icon: 'person', route: '/pp-daerah/profil' },
];

export const PENGADIL_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/pengadil' },
  { label: 'Profil Saya', icon: 'person', route: '/pengadil/profil' },
  { label: 'Notifikasi Lantikan', icon: 'notifications_active', route: '/pengadil/notifikasi-lantikan' },
  { label: 'Rekod Perlawanan', icon: 'sports', route: '/pengadil/perlawanan' },
  { label: 'Penilaian Saya', icon: 'rate_review', route: '/pengadil/penilaian' },
  {
    label: 'Permohonan',
    icon: 'description',
    children: [
      { label: 'Pendaftaran Tahunan (R1)', icon: 'badge', route: '/pengadil/permohonan/berdaftar' },
      { label: 'Kelas III FAM', icon: 'quiz', route: '/pengadil/permohonan/kelas3' },
      { label: 'Ujian Kelas I FAM', icon: 'military_tech', route: '/pengadil/permohonan/kelas1' },
    ],
  },
];

export const PENILAI_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/penilai' },
  { label: 'Penilaian Pengadil', icon: 'rate_review', route: '/penilai/penilaian' },
  { label: 'Pendaftaran Tahunan (R4)', icon: 'how_to_reg', route: '/penilai/permohonan/tahunan' },
  { label: 'Tugasan', icon: 'assignment', route: '/penilai/tugasan' },
  { label: 'Statistik', icon: 'bar_chart', route: '/penilai/statistik' },
  { label: 'Profil', icon: 'person', route: '/penilai/profil' },
];

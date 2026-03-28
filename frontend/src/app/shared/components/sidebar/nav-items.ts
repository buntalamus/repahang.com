export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
  { label: 'Permohonan', icon: 'description', route: '/admin/permohonan' },
  { label: 'Pengadil Berdaftar', icon: 'people', route: '/admin/pengadil-berdaftar' },
  { label: 'Pengguna', icon: 'group', route: '/admin/pengguna' },
  { label: 'Lantikan Pengadil', icon: 'assignment_ind', route: '/admin/lantikan' },
  { label: 'Pengadil Luar', icon: 'person_add', route: '/admin/pengadil-luar' },
  { label: 'Statistik', icon: 'bar_chart', route: '/admin/statistik' },
  { label: 'Pengumuman', icon: 'campaign', route: '/admin/pengumuman' },
  { label: 'Tetapan', icon: 'settings', route: '/admin/tetapan' },
  { label: 'Profil Saya', icon: 'person', route: '/admin/profil' },
];

export const PP_DAERAH_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/pp-daerah' },
  {
    label: 'Permohonan',
    icon: 'description',
    children: [
      { label: 'Pengadil Berdaftar', icon: 'people', route: '/pp-daerah/permohonan/berdaftar' },
      { label: 'Pengadil Futsal', icon: 'sports_soccer', route: '/pp-daerah/permohonan/futsal' },
      { label: 'Ujian Kecergasan', icon: 'fitness_center', route: '/pp-daerah/permohonan/kecergasan' },
      { label: 'Ujian Kelas III FAM', icon: 'quiz', route: '/pp-daerah/permohonan/bertulis' },
      { label: 'Ujian Kelas 1 FAM', icon: 'military_tech', route: '/pp-daerah/permohonan/kelas1' },
    ],
  },
  { label: 'Pengadil', icon: 'people', route: '/pp-daerah/pengadil' },
  { label: 'Lantikan', icon: 'assignment_ind', route: '/pp-daerah/lantikan' },
  { label: 'Statistik', icon: 'bar_chart', route: '/pp-daerah/statistik' },
  { label: 'Pengesahan', icon: 'verified', route: '/pp-daerah/pengesahan' },
  { label: 'Profil', icon: 'person', route: '/pp-daerah/profil' },
];

export const PENGADIL_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/pengadil' },
  { label: 'Profil Saya', icon: 'person', route: '/pengadil/profil' },
  { label: 'Tugasan Lantikan', icon: 'assignment_ind', route: '/pengadil/tugasan' },
  { label: 'Rekod Perlawanan', icon: 'sports', route: '/pengadil/perlawanan' },
  {
    label: 'Permohonan',
    icon: 'description',
    children: [
      { label: 'Pengadil Berdaftar', icon: 'badge', route: '/pengadil/permohonan/berdaftar' },
      { label: 'Pengadil Futsal', icon: 'sports_soccer', route: '/pengadil/permohonan/futsal' },
      { label: 'Ujian Kecergasan', icon: 'fitness_center', route: '/pengadil/permohonan/kecergasan' },
      { label: 'Ujian Kelas III FAM', icon: 'quiz', route: '/pengadil/permohonan/bertulis' },
      { label: 'Ujian Kelas 1 FAM', icon: 'military_tech', route: '/pengadil/permohonan/kelas1' },
    ],
  },
];

export const PENILAI_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/penilai' },
  { label: 'Penilaian Pengadil', icon: 'rate_review', route: '/penilai/penilaian' },
  { label: 'Permohonan', icon: 'description', route: '/penilai/permohonan' },
  { label: 'Tugasan', icon: 'assignment', route: '/penilai/tugasan' },
  { label: 'Statistik', icon: 'bar_chart', route: '/penilai/statistik' },
  { label: 'Profil', icon: 'person', route: '/penilai/profil' },
];

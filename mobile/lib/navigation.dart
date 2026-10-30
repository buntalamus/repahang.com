import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/notifikasi_screen.dart';
import 'screens/pengumuman_screen.dart';
import 'screens/perlu_tindakan_screen.dart';

/// Something the full menu can open: a shell page (by id), an in-app screen,
/// or a website page that is not in the app yet.
class MenuEntry {
  const MenuEntry(this.label, this.icon, {this.page, this.screen, this.web});
  final String label;
  final IconData icon;

  /// Shell page id (a bottom tab or an extra page).
  final String? page;

  /// Screen pushed on top of the shell.
  final Widget Function()? screen;

  /// Website path opened in the browser.
  final String? web;

  bool get external => page == null && screen == null;
}

class MenuSection {
  const MenuSection(this.title, this.entries);
  final String title;
  final List<MenuEntry> entries;
}

/// The home screen's quick actions: in-app pages first, then website pages.
/// Profile is left out because the avatar in the header opens it.
List<MenuEntry> quickMenuFor(SessionUser user, {int count = 8}) {
  final all = menuFor(user).expand((s) => s.entries).where((e) => e.page != 'profil').toList();
  return [...all.where((e) => !e.external), ...all.where((e) => e.external)].take(count).toList();
}

/// Everything each role can do, grouped like the website sidebar.
List<MenuSection> menuFor(SessionUser user) {
  MenuEntry page(String label, IconData icon, String id) => MenuEntry(label, icon, page: id);
  MenuEntry screen(String label, IconData icon, Widget Function() build) => MenuEntry(label, icon, screen: build);
  MenuEntry web(String label, IconData icon, String path) => MenuEntry(label, icon, web: path);

  final profil = page('Profil Saya', Icons.person_outline_rounded, 'profil');
  final notifikasi = screen('Notifikasi', Icons.notifications_none_rounded, () => const NotifikasiScreen());
  final pengumuman = screen('Pengumuman', Icons.campaign_outlined, () => const PengumumanScreen());
  final perluTindakan = screen('Perlu Tindakan', Icons.warning_amber_rounded, () => const PerluTindakanScreen());

  return switch (user.role) {
    'Admin' => [
        MenuSection('Permohonan', [
          page('Kelulusan', Icons.task_alt_rounded, 'kelulusan'),
          web('Permohonan Penilai', Icons.rate_review_outlined, '/admin/permohonan-ra'),
        ]),
        MenuSection('Lantikan & Perlawanan', [
          page('Lantikan Pegawai', Icons.event_note_outlined, 'lantikan'),
          perluTindakan,
          web('Rekod Perlawanan', Icons.sports_soccer_outlined, '/admin/perlawanan'),
          web('Pengadil Luar', Icons.person_add_alt, '/admin/pengadil-luar'),
        ]),
        MenuSection('Pengadil & Pegawai', [
          web('Pengadil Berdaftar', Icons.groups_outlined, '/admin/pengadil-berdaftar'),
          web('Penilai Berdaftar', Icons.rate_review_outlined, '/admin/ra-berdaftar'),
          web('PP Daerah', Icons.admin_panel_settings_outlined, '/admin/pp-daerah'),
          web('Pengguna', Icons.manage_accounts_outlined, '/admin/pengguna'),
        ]),
        MenuSection('Komunikasi', [
          notifikasi,
          pengumuman,
          web('Chat Pengguna', Icons.forum_outlined, '/admin/chat'),
          web('Peti Emel', Icons.mail_outline_rounded, '/admin/emel'),
        ]),
        MenuSection('Sistem', [
          web('Statistik', Icons.bar_chart_rounded, '/admin/statistik'),
          web('Laporan', Icons.summarize_outlined, '/admin/laporan'),
          web('Tetapan', Icons.settings_outlined, '/admin/tetapan'),
          profil,
        ]),
      ],
    'PP Daerah' => [
        MenuSection('Daerah', [
          page('Semakan', Icons.fact_check_outlined, 'semakan'),
          page('Lantikan Daerah', Icons.event_note_outlined, 'lantikan'),
          perluTindakan,
          web('Pengadil Berdaftar', Icons.groups_outlined, '/pp-daerah/pengadil'),
          web('Penilai Berdaftar', Icons.rate_review_outlined, '/pp-daerah/ra-berdaftar'),
          web('Laporan Penilaian', Icons.assessment_outlined, '/pp-daerah/laporan-penilaian'),
          web('Statistik Daerah', Icons.insights_outlined, '/pp-daerah/statistik'),
        ]),
        MenuSection('Tugasan Saya', [
          page('Tugasan', Icons.assignment_outlined, 'tugasan'),
          if (user.canRa) page('Laporan RA', Icons.rate_review_outlined, 'laporan'),
          page('Permohonan Saya', Icons.description_outlined, 'permohonan'),
        ]),
        MenuSection('Komunikasi', [notifikasi, pengumuman]),
        MenuSection('Akaun', [profil]),
      ],
    'Penilai' => [
        MenuSection('Tugasan', [
          page('Tugasan', Icons.assignment_outlined, 'tugasan'),
          page('Laporan Penilaian', Icons.rate_review_outlined, 'laporan'),
          web('Statistik', Icons.bar_chart_rounded, '/penilai/statistik'),
        ]),
        MenuSection('Permohonan', [page('Permohonan Saya', Icons.description_outlined, 'permohonan')]),
        MenuSection('Komunikasi', [notifikasi, pengumuman]),
        MenuSection('Akaun', [profil]),
      ],
    _ => [
        MenuSection('Tugasan & Rekod', [
          page('Tugasan', Icons.assignment_outlined, 'tugasan'),
          page('Rekod Perlawanan', Icons.sports_outlined, 'rekod'),
          web('Statistik Saya', Icons.insights_outlined, '/pengadil/statistik'),
        ]),
        MenuSection('Permohonan', [page('Permohonan Saya', Icons.description_outlined, 'permohonan')]),
        MenuSection('Komunikasi', [notifikasi, pengumuman]),
        MenuSection('Akaun', [profil]),
      ],
  };
}

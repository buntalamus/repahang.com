import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'dashboard_admin_screen.dart';
import 'kelulusan_screen.dart';
import 'lantikan_admin_screen.dart';
import 'laporan_ra_screen.dart';
import 'notifikasi_screen.dart';
import 'pengesahan_screen.dart';
import 'penilaian_screen.dart';
import 'perlawanan_screen.dart';
import 'permohonan_screen.dart';
import 'profil_screen.dart';
import 'tugasan_screen.dart';

class _Tab {
  const _Tab(this.id, this.label, this.title, this.icon, this.build, {this.primary = true});
  final String id;
  final String label;
  final String title;
  final IconData icon;
  final Widget Function(Key key) build;

  /// Primary tabs sit in the bottom bar (at most five); the rest open from the drawer.
  final bool primary;
}

/// Tabs per role: the light, frequent tasks of each role. Everything else
/// opens the website.
List<_Tab> _tabsFor(SessionUser user, void Function(String) openTab) {
  _Tab tugasan() =>
      _Tab('tugasan', 'Tugasan', 'Tugasan Lantikan', Icons.assignment_ind_outlined, (k) => TugasanScreen(key: k));
  _Tab permohonan({bool primary = true}) => _Tab('permohonan', 'Permohonan', 'Permohonan Saya',
      Icons.description_outlined, (k) => PermohonanScreen(key: k), primary: primary);
  _Tab laporan({bool primary = true}) => _Tab('laporan', 'Laporan RA', 'Tugasan Penilai', Icons.rate_review_outlined,
      (k) => LaporanRaScreen(key: k), primary: primary);
  _Tab lantikan(String title) =>
      _Tab('lantikan', 'Lantikan', title, Icons.event_note_outlined, (k) => LantikanAdminScreen(key: k));
  final profil = _Tab('profil', 'Profil', 'Profil Saya', Icons.person_outline, (k) => ProfilScreen(key: k));
  return switch (user.role) {
    'Admin' => [
        _Tab('dashboard', 'Dashboard', 'Dashboard', Icons.dashboard_outlined,
            (k) => DashboardAdminScreen(key: k, onOpenTab: openTab)),
        _Tab('kelulusan', 'Kelulusan', 'Kelulusan Permohonan', Icons.task_alt, (k) => KelulusanScreen(key: k, admin: true)),
        lantikan('Lantikan Pegawai'),
        profil,
      ],
    'PP Daerah' => [
        tugasan(),
        lantikan('Lantikan Daerah'),
        _Tab('pengesahan', 'Pengesahan', 'Pengesahan Perlawanan', Icons.fact_check_outlined,
            (k) => PengesahanScreen(key: k)),
        _Tab('semakan', 'Semakan', 'Semakan Permohonan', Icons.task_alt, (k) => KelulusanScreen(key: k, admin: false)),
        profil,
        if (user.canRa) laporan(primary: false),
        permohonan(primary: false),
      ],
    'Penilai' => [tugasan(), laporan(), permohonan(), profil],
    _ => [
        tugasan(),
        _Tab('perlawanan', 'Perlawanan', 'Rekod Perlawanan', Icons.sports_outlined, (k) => PerlawananScreen(key: k)),
        _Tab('penilaian', 'Penilaian', 'Penilaian Saya', Icons.grading_outlined, (k) => PenilaianScreen(key: k)),
        permohonan(),
        profil,
      ],
  };
}

/// Website pages listed in the drawer, as in the sidebar of each role.
List<(String, IconData, String)> _webLinksFor(SessionUser user) => switch (user.role) {
      'Admin' => [
          ('Dashboard', Icons.dashboard_outlined, '/admin'),
          ('Permohonan', Icons.description_outlined, '/admin/permohonan'),
          ('Pengguna', Icons.people_outline, '/admin/pengguna'),
          ('Statistik', Icons.insights_outlined, '/admin/statistik'),
          ('Pengumuman', Icons.campaign_outlined, '/admin/pengumuman'),
        ],
      'PP Daerah' => [
          ('Dashboard', Icons.dashboard_outlined, '/pp-daerah'),
          ('Pengesahan Perlawanan', Icons.fact_check_outlined, '/pp-daerah/pengesahan-perlawanan'),
          ('Statistik', Icons.insights_outlined, '/pp-daerah/statistik'),
        ],
      'Penilai' => [
          ('Dashboard', Icons.dashboard_outlined, '/penilai'),
          ('Penilaian Pengadil', Icons.rate_review_outlined, '/penilai/penilaian'),
          ('Statistik', Icons.bar_chart_outlined, '/penilai/statistik'),
        ],
      _ => [
          ('Dashboard', Icons.dashboard_outlined, '/pengadil'),
          ('Statistik Saya', Icons.insights_outlined, '/pengadil/statistik'),
          ('Penilaian Saya', Icons.rate_review_outlined, '/pengadil/penilaian'),
        ],
    };

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  final _scaffold = GlobalKey<ScaffoldState>();
  late final SessionUser _user = Api.instance.user.value!;
  late final List<_Tab> _all = _tabsFor(_user, _openTab);
  late final List<_Tab> _tabs = _all.where((t) => t.primary).toList();
  late final List<_Tab> _extra = _all.where((t) => !t.primary).toList();
  late final List<int> _generation = List.filled(_tabs.length, 0);
  int _index = 0;
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PushService.instance.openScreen.addListener(_openFromPush);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _openFromPush();
      _checkVersion();
    });
    _loadUnread();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PushService.instance.openScreen.removeListener(_openFromPush);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadUnread();
  }

  Future<void> _loadUnread() async {
    try {
      final body = await Api.instance.get('/api/notifications.php');
      if (mounted) setState(() => _unread = (body['unread_count'] as num?)?.toInt() ?? 0);
    } catch (_) {
      // The badge is optional.
    }
  }

  /// Push `screen` values from the server: lantikan, permohonan, sejarah, notifikasi.
  void _openFromPush() {
    final screen = PushService.instance.openScreen.value;
    if (screen == null || !mounted) return;
    PushService.instance.openScreen.value = null;
    _loadUnread();
    final candidates = switch (screen) {
      'lantikan' => ['tugasan', 'lantikan'],
      'permohonan' => ['permohonan', 'semakan', 'kelulusan'],
      'sejarah' => ['perlawanan', 'pengesahan', 'penilaian', 'laporan'],
      _ => [screen],
    };
    for (final id in candidates) {
      if (_tabs.any((t) => t.id == id) || _extra.any((t) => t.id == id)) {
        _openTab(id, refresh: true);
        return;
      }
    }
    _openNotifications();
  }

  /// Selects a bottom-bar tab, or opens a drawer-only one as its own page.
  void _openTab(String id, {bool refresh = false}) {
    final tab = _tabs.indexWhere((t) => t.id == id);
    if (tab >= 0) {
      setState(() {
        _index = tab;
        if (refresh) _generation[tab] += 1;
      });
      return;
    }
    final extra = _extra.where((t) => t.id == id).firstOrNull;
    if (extra == null) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => Scaffold(appBar: AppBar(title: Text(extra.title)), body: extra.build(UniqueKey())),
    ));
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const NotifikasiScreen()));
    _loadUnread();
  }

  Future<void> _logout() async {
    final ok = await showWebModal<bool>(
      context,
      title: 'Log Keluar',
      body: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Notifikasi tidak akan dihantar ke telefon ini selepas log keluar.',
            style: TextStyle(fontSize: 14, color: Tw.slate600)),
        const SizedBox(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          OutlineButton(label: 'Batal', onPressed: () => Navigator.pop(context, false)),
          const SizedBox(width: 12),
          YellowButton(label: 'Log Keluar', icon: Icons.logout, onPressed: () => Navigator.pop(context, true)),
        ]),
      ]),
    );
    if (ok != true) return;
    await PushService.instance.stop();
    await Api.instance.logout();
  }

  Future<void> _checkVersion() async {
    try {
      final body = await Api.instance.get('/api/mobile-version.php');
      final info = await PackageInfo.fromPlatform();
      final url = '${Platform.isIOS ? body['ios_url'] ?? '' : body['android_url'] ?? ''}';
      final required = _older(info.version, '${body['min_version']}');
      if (!mounted || (!required && !_older(info.version, '${body['latest_version']}')) || url.isEmpty) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: !required,
        builder: (context) => PopScope(
          canPop: !required,
          child: AlertDialog(
            title: const Text('Versi baharu tersedia', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            content: Text(required
                ? 'Sila kemas kini app untuk terus menggunakannya.'
                : 'Kemas kini app untuk mendapat ciri dan pembetulan terkini.'),
            actions: [
              if (!required) OutlineButton(label: 'Nanti', onPressed: () => Navigator.pop(context)),
              YellowButton(label: 'Kemas kini',
                  onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)),
            ],
          ),
        ),
      );
    } catch (_) {
      // Version check never blocks the app when offline.
    }
  }

  static bool _older(String current, String target) {
    List<int> parts(String v) => v.split(RegExp(r'[.+]')).take(3).map((p) => int.tryParse(p) ?? 0).toList();
    final a = parts(current), b = parts(target);
    for (var i = 0; i < 3; i++) {
      final x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0;
      if (x != y) return x < y;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final tab = _tabs[_index];
    return Scaffold(
      key: _scaffold,
      drawer: _sidebar(),
      appBar: AppBar(
        toolbarHeight: 68,
        leading: IconButton(
          tooltip: 'Buka menu navigasi',
          icon: const Icon(Icons.menu, color: Tw.slate700),
          onPressed: () => _scaffold.currentState?.openDrawer(),
        ),
        titleSpacing: 0,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('PANEL PENGURUSAN',
              style: TextStyle(fontSize: 11, letterSpacing: 4, color: Tw.slate600, fontWeight: FontWeight.w400)),
          Text(tab.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Tw.slate900)),
        ]),
        actions: [
          IconButton(
            tooltip: 'Buka notifikasi',
            onPressed: _openNotifications,
            icon: Badge(
              isLabelVisible: _unread > 0,
              backgroundColor: Tw.red700,
              label: Text(_unread > 9 ? '9+' : '$_unread', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
              child: const Icon(Icons.notifications, color: Tw.slate600),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: IndexedStack(index: _index, children: [
        for (var i = 0; i < _tabs.length; i++) _tabs[i].build(ValueKey('${_tabs[i].id}-${_generation[i]}')),
      ]),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Tw.pahangBlack,
          indicatorColor: const Color(0x1AFFFFFF),
          labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
                fontSize: 12,
                fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w400,
                color: states.contains(WidgetState.selected) ? Tw.pahangYellow : const Color(0x99FFFFFF),
              )),
          iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
                color: states.contains(WidgetState.selected) ? Tw.pahangYellow : const Color(0x99FFFFFF),
              )),
        ),
        child: NavigationBar(
          height: 68,
          selectedIndex: _index,
          onDestinationSelected: (index) => setState(() => _index = index),
          destinations: [for (final t in _tabs) NavigationDestination(icon: Icon(t.icon), label: t.label)],
        ),
      ),
    );
  }

  /// shared/components/sidebar: black panel, logo, yellow role label.
  Widget _sidebar() {
    Widget item(IconData icon, String label, {bool active = false, bool external = false, required VoidCallback onTap}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Material(
          color: active ? const Color(0x1AFFFFFF) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                Icon(icon, size: 20, color: active ? Tw.pahangYellow : const Color(0x99FFFFFF)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(label,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                          color: active ? Tw.pahangYellow : const Color(0x99FFFFFF))),
                ),
                if (external) const Icon(Icons.open_in_new, size: 14, color: Color(0x66FFFFFF)),
              ]),
            ),
          ),
        ),
      );
    }

    Widget section(String label) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
          child: Text(label.toUpperCase(),
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1, color: Color(0xB3FFFFFF))),
        );

    return Drawer(
      backgroundColor: Tw.pahangBlack,
      width: 272,
      shape: const RoundedRectangleBorder(),
      child: SafeArea(
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x1AFFFFFF)))),
            child: Row(children: [
              Container(
                width: 40,
                height: 40,
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: ClipOval(child: Image.asset('assets/images/logo-pahang.png')),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_user.role.toUpperCase(),
                      style: const TextStyle(fontSize: 12, letterSpacing: 1.6, color: Color(0xCCFADA00))),
                  const Text('Pengadil PBNP',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                ]),
              ),
            ]),
          ),
          Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
              for (var i = 0; i < _tabs.length; i++)
                item(_tabs[i].icon, _tabs[i].title, active: i == _index, onTap: () {
                  Navigator.pop(context);
                  setState(() => _index = i);
                }),
              for (final t in _extra)
                item(t.icon, t.title, onTap: () {
                  Navigator.pop(context);
                  _openTab(t.id);
                }),
              item(Icons.notifications_active_outlined, 'Notifikasi', onTap: () {
                Navigator.pop(context);
                _openNotifications();
              }),
              section('Di website'),
              for (final (label, icon, path) in _webLinksFor(_user))
                item(icon, label, external: true, onTap: () => openWebsite(context, path)),
            ]),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0x1AFFFFFF)))),
            child: Column(children: [
              Text(_user.email, style: const TextStyle(fontSize: 12, color: Color(0x99FFFFFF)), overflow: TextOverflow.ellipsis),
              const SizedBox(height: 12),
              YellowButton(label: 'Log Keluar', icon: Icons.logout, expand: true, onPressed: () {
                Navigator.pop(context);
                _logout();
              }),
              const SizedBox(height: 12),
              const Text('Pertanyaan teknikal:', style: TextStyle(fontSize: 12, color: Color(0xB3FFFFFF))),
              const Text('sokongan@pbnppahang.my', style: TextStyle(fontSize: 12, color: Color(0x99FFFFFF))),
            ]),
          ),
        ]),
      ),
    );
  }
}

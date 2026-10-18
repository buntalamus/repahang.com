import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../updater.dart';
import '../widgets/common.dart';
import 'kelulusan_screen.dart';
import 'lantikan_admin_screen.dart';
import 'laporan_ra_screen.dart';
import 'notifikasi_screen.dart';
import 'permohonan_screen.dart';
import 'profil_screen.dart';
import 'rekod_screen.dart';
import 'semakan_screen.dart';
import 'tugasan_screen.dart';
import 'utama_screen.dart';

/// A page the shell can show: a bottom-bar tab, or (primary: false) a page
/// opened from the profile menu.
class AppPage {
  const AppPage(this.id, this.label, this.title, this.icon, this.selectedIcon, this.build, {this.primary = true});
  final String id;
  final String label;
  final String title;
  final IconData icon;
  final IconData selectedIcon;
  final Widget Function(Key key) build;
  final bool primary;
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  late final SessionUser _user = Api.instance.user.value!;
  late final List<AppPage> _all = _pagesFor(_user);
  late final List<AppPage> _tabs = _all.where((t) => t.primary).toList();
  late final List<AppPage> _extra = _all.where((t) => !t.primary).toList();
  late final List<int> _generation = List.filled(_tabs.length, 0);
  int _index = 0;
  int _unread = 0;

  /// Each role's frequent tasks; everything else opens the website.
  List<AppPage> _pagesFor(SessionUser user) {
    AppPage utama() => AppPage('utama', 'Utama', 'Utama', Icons.home_outlined, Icons.home_rounded,
        (k) => UtamaScreen(key: k, onOpenTab: _openTab, onOpenNotifications: _openNotifications, unread: _unread));
    AppPage tugasan() => AppPage('tugasan', 'Tugasan', 'Tugasan', Icons.assignment_outlined, Icons.assignment,
        (k) => TugasanScreen(key: k));
    AppPage permohonan({bool primary = true}) => AppPage('permohonan', 'Permohonan', 'Permohonan Saya',
        Icons.description_outlined, Icons.description, (k) => PermohonanScreen(key: k), primary: primary);
    AppPage laporan({bool primary = true}) => AppPage('laporan', 'Laporan', 'Tugasan Penilai',
        Icons.rate_review_outlined, Icons.rate_review, (k) => LaporanRaScreen(key: k), primary: primary);
    AppPage lantikan() => AppPage('lantikan', 'Lantikan', user.isAdmin ? 'Lantikan Pegawai' : 'Lantikan Daerah',
        Icons.event_note_outlined, Icons.event_note, (k) => LantikanAdminScreen(key: k));
    final profil = AppPage('profil', 'Profil', 'Profil', Icons.person_outline, Icons.person,
        (k) => ProfilScreen(key: k, extraPages: _extra, onOpenPage: _openTab));
    return switch (user.role) {
      'Admin' => [
          utama(),
          AppPage('kelulusan', 'Kelulusan', 'Kelulusan', Icons.task_alt_outlined, Icons.task_alt,
              (k) => KelulusanView(key: k, admin: true)),
          lantikan(),
          profil,
        ],
      'PP Daerah' => [
          utama(),
          tugasan(),
          lantikan(),
          AppPage('semakan', 'Semakan', 'Semakan', Icons.fact_check_outlined, Icons.fact_check,
              (k) => SemakanScreen(key: k)),
          profil,
          if (user.canRa) laporan(primary: false),
          permohonan(primary: false),
        ],
      'Penilai' => [utama(), tugasan(), laporan(), permohonan(), profil],
      _ => [
          utama(),
          tugasan(),
          AppPage('rekod', 'Rekod', 'Rekod Saya', Icons.sports_outlined, Icons.sports, (k) => RekodScreen(key: k)),
          permohonan(),
          profil,
        ],
    };
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PushService.instance.openScreen.addListener(_openFromPush);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _openFromPush();
      _checkVersion();
      AppUpdater.instance.check();
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
    if (state == AppLifecycleState.resumed) {
      _loadUnread();
      AppUpdater.instance.check();
    }
  }

  Future<void> _loadUnread() async {
    try {
      final body = await Api.instance.get('/api/notifications.php');
      if (mounted) setState(() => _unread = (body['unread_count'] as num?)?.toInt() ?? 0);
    } catch (_) {
      // The badge is optional.
    }
  }

  /// Push `screen` values: lantikan, permohonan, sejarah, notifikasi, update.
  void _openFromPush() {
    final screen = PushService.instance.openScreen.value;
    if (screen == null || !mounted) return;
    PushService.instance.openScreen.value = null;
    if (screen == 'update') {
      _offerUpdate(force: true);
      return;
    }
    _loadUnread();
    final candidates = switch (screen) {
      'lantikan' => ['tugasan', 'lantikan'],
      'permohonan' => ['permohonan', 'semakan', 'kelulusan'],
      'sejarah' => ['rekod', 'semakan', 'laporan'],
      _ => [screen],
    };
    for (final id in candidates) {
      if (_all.any((t) => t.id == id)) {
        _openTab(id, refresh: true);
        return;
      }
    }
    _openNotifications();
  }

  /// Selects a bottom-bar tab, or opens a profile-menu page on its own.
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

  Future<void> _offerUpdate({bool force = false}) async {
    final updater = AppUpdater.instance;
    if (!updater.ready.value) {
      if (updater.available) showToast(context, 'Menyemak kemas kini...', ToastType.info);
      await updater.check(force: force);
    }
    if (!mounted) return;
    if (!updater.ready.value) {
      showToast(context, updater.available ? 'App anda sudah versi terkini.' : 'Kemas kini automatik tidak tersedia.',
          ToastType.info);
      return;
    }
    final restart = await confirmSheet(context,
        title: 'Kemas kini sedia',
        message: 'Versi terkini RefPahang telah dimuat turun. Mula semula app sekarang untuk menggunakannya.',
        confirmLabel: 'Mula semula sekarang');
    if (restart) await updater.restart();
  }

  Future<void> _checkVersion() async {
    try {
      final body = await Api.instance.get('/api/mobile-version.php');
      final info = await PackageInfo.fromPlatform();
      final url = '${Platform.isIOS ? body['ios_url'] ?? '' : body['android_url'] ?? ''}';
      final required = _older(info.version, '${body['min_version']}');
      if (!mounted || (!required && !_older(info.version, '${body['latest_version']}')) || url.isEmpty) return;
      await showModalBottomSheet<void>(
        context: context,
        isDismissible: !required,
        enableDrag: !required,
        builder: (context) => PopScope(
          canPop: !required,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Icon(Icons.system_update_rounded, size: 48),
              const SizedBox(height: 12),
              const Text('Versi baharu tersedia', textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(
                required
                    ? 'Versi ini tidak lagi disokong. Muat turun dan pasang versi terkini untuk terus menggunakan app.'
                    : 'Muat turun dan pasang versi terkini untuk ciri baharu.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                child: const Text('Muat turun'),
              ),
              if (!required) TextButton(onPressed: () => Navigator.pop(context), child: const Text('Nanti')),
            ]),
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
    final home = tab.id == 'utama';
    return Scaffold(
      appBar: home
          ? null
          : AppBar(
              title: Text(tab.title),
              actions: [
                IconButton(
                  tooltip: 'Notifikasi',
                  onPressed: _openNotifications,
                  icon: Badge(
                    isLabelVisible: _unread > 0,
                    backgroundColor: Tw.red600,
                    label: Text(_unread > 9 ? '9+' : '$_unread'),
                    child: const Icon(Icons.notifications_none_rounded),
                  ),
                ),
                const SizedBox(width: 4),
              ],
            ),
      body: Column(children: [
        ValueListenableBuilder<bool>(
          valueListenable: AppUpdater.instance.ready,
          builder: (context, ready, _) => ready ? _UpdateBanner(onRestart: () => _offerUpdate()) : const SizedBox.shrink(),
        ),
        Expanded(
          child: IndexedStack(index: _index, children: [
            for (var i = 0; i < _tabs.length; i++)
              _tabs[i].id == 'utama'
                  // Home shows the live unread count, so it is rebuilt with it.
                  ? UtamaScreen(key: ValueKey('utama-${_generation[i]}'), onOpenTab: _openTab,
                      onOpenNotifications: _openNotifications, unread: _unread)
                  : _tabs[i].build(ValueKey('${_tabs[i].id}-${_generation[i]}')),
          ]),
        ),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: [
          for (final t in _tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selectedIcon), label: t.label),
        ],
      ),
    );
  }
}

class _UpdateBanner extends StatelessWidget {
  const _UpdateBanner({required this.onRestart});
  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Tw.pahangYellow,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          child: Row(children: [
            const Icon(Icons.system_update_rounded, color: AppColors.black),
            const SizedBox(width: 12),
            const Expanded(
              child: Text('Versi baharu sedia digunakan', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            TextButton(onPressed: onRestart, child: const Text('Mula semula')),
          ]),
        ),
      ),
    );
  }
}

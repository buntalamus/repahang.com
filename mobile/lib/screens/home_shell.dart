import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../navigation.dart';
import '../push.dart';
import '../release_notes.dart';
import '../theme.dart';
import '../updater.dart';
import '../widgets/app_menu.dart';
import '../widgets/common.dart';
import '../widgets/update_notes.dart';
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
import 'pengumuman_screen.dart';

/// A page the shell can show: a bottom-bar tab (the [center] one is the round
/// button), or (primary: false) a page opened from the menu.
class AppPage {
  const AppPage(this.id, this.label, this.title, this.icon, this.selectedIcon, this.build,
      {this.primary = true, this.center = false});
  final String id;
  final String label;
  final String title;
  final IconData icon;
  final IconData selectedIcon;
  final Widget Function(Key key) build;
  final bool primary;
  final bool center;
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

  /// Each role's bottom bar (the middle page is the round button) plus the
  /// pages only reached from the menu.
  List<AppPage> _pagesFor(SessionUser user) {
    AppPage utama() => AppPage('utama', 'Utama', 'Utama', Icons.home_outlined, Icons.home_rounded,
        (k) => UtamaScreen(key: k, onOpenTab: _openTab, onOpenNotifications: _openNotifications,
            onOpenEntry: _openEntry, unread: _unread));
    AppPage tugasan({bool primary = true, bool center = false}) => AppPage('tugasan', 'Tugasan', 'Tugasan',
        Icons.assignment_outlined, Icons.assignment, (k) => TugasanScreen(key: k), primary: primary, center: center);
    AppPage permohonan({bool primary = true}) => AppPage('permohonan', 'Permohonan', 'Permohonan Saya',
        Icons.description_outlined, Icons.description, (k) => PermohonanScreen(key: k), primary: primary);
    AppPage laporan({bool primary = true, bool center = false}) => AppPage('laporan', 'Laporan', 'Tugasan Penilai',
        Icons.rate_review_outlined, Icons.rate_review, (k) => LaporanRaScreen(key: k), primary: primary, center: center);
    AppPage lantikan({bool center = false}) => AppPage('lantikan', 'Lantikan',
        user.isAdmin ? 'Lantikan Pegawai' : 'Lantikan Daerah', Icons.event_note_outlined, Icons.event_note,
        (k) => LantikanAdminScreen(key: k), center: center);
    AppPage semakan({bool center = false}) => AppPage('semakan', 'Semakan', 'Semakan', Icons.fact_check_outlined,
        Icons.fact_check, (k) => SemakanScreen(key: k), center: center);
    final profil = AppPage('profil', 'Profil', 'Profil', Icons.person_outline, Icons.person,
        (k) => ProfilScreen(key: k));
    return switch (user.role) {
      'Admin' => [
          utama(),
          AppPage('kelulusan', 'Kelulusan', 'Kelulusan', Icons.task_alt_outlined, Icons.task_alt,
              (k) => KelulusanView(key: k, admin: true)),
          lantikan(center: true),
          AppPage('semua', 'Semua', 'Semua Fungsi', Icons.grid_view_outlined, Icons.grid_view_rounded,
              (k) => MenuScreen(key: k, user: user, onOpen: _openEntry, embedded: true)),
          profil,
        ],
      'PP Daerah' => [
          utama(),
          lantikan(),
          semakan(center: true),
          tugasan(),
          profil,
          if (user.canRa) laporan(primary: false),
          permohonan(primary: false),
        ],
      'Penilai' => [utama(), tugasan(), laporan(center: true), permohonan(), profil],
      _ => [
          utama(),
          AppPage('rekod', 'Rekod', 'Rekod Saya', Icons.sports_outlined, Icons.sports, (k) => RekodScreen(key: k)),
          tugasan(center: true),
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

  /// Push `screen` values include `pengumuman:<id>` for full announcement content.
  void _openFromPush() {
    final screen = PushService.instance.openScreen.value;
    if (screen == null || !mounted) return;
    PushService.instance.openScreen.value = null;
    final announcement = RegExp(r'^pengumuman:([1-9]\d*)$').firstMatch(screen);
    if (announcement != null) {
      openAnnouncement(context, int.parse(announcement[1]!)).then((_) {
        if (!mounted) return;
        _loadUnread();
        _openTab('utama', refresh: true);
      });
      return;
    }
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

  Future<void> _openEntry(MenuEntry entry) async {
    if (entry.page != null) return _openTab(entry.page!);
    if (entry.screen != null) {
      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => entry.screen!()));
      _loadUnread();
      return;
    }
    await openWebsite(context, entry.web!);
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
        details: UpdateNotes(load: updater.pendingReleaseNotes),
        message: 'Versi terkini RefPahang telah dimuat turun. Mula semula app sekarang untuk menggunakannya.',
        confirmLabel: 'Mula semula sekarang');
    if (restart) await updater.restart();
  }

  Future<void> _checkVersion() async {
    // The web build is always the deployed version.
    if (kIsWeb) return;
    try {
      final body = await Api.instance.get('/api/mobile-version.php');
      final info = await PackageInfo.fromPlatform();
      final url = '${defaultTargetPlatform == TargetPlatform.iOS ? body['ios_url'] ?? '' : body['android_url'] ?? ''}';
      final required = _older(info.version, '${body['min_version']}');
      if (!mounted || (!required && !_older(info.version, '${body['latest_version']}')) || url.isEmpty) return;
      await showModalBottomSheet<void>(
        context: context,
        isDismissible: !required,
        enableDrag: !required,
        builder: (context) => PopScope(
          canPop: !required,
          child: SingleChildScrollView(
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
              UpdateNotes(load: () async => selectNativeNotes(await fetchReleaseNotes(), '${body['latest_version']}')),
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
              HeroMode(enabled: i == _index, child: _tabs[i].id == 'utama'
                  // Home shows the live unread count, so it is rebuilt with it.
                  ? UtamaScreen(key: ValueKey('utama-${_generation[i]}'), onOpenTab: _openTab,
                      onOpenNotifications: _openNotifications, onOpenEntry: _openEntry, unread: _unread)
                  : _tabs[i].build(ValueKey('${_tabs[i].id}-${_generation[i]}'))),
          ]),
        ),
      ]),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: _center < 0
          ? null
          : _CenterButton(page: _tabs[_center], selected: _index == _center, onTap: () => setState(() => _index = _center)),
      bottomNavigationBar: _BottomBar(
        tabs: _tabs,
        index: _index,
        onSelect: (index) => setState(() => _index = index),
      ),
    );
  }

  int get _center => _tabs.indexWhere((t) => t.center);
}

/// White bottom bar with a notch for the round middle button.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.tabs, required this.index, required this.onSelect});
  final List<AppPage> tabs;
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return BottomAppBar(
      shape: const CircularNotchedRectangle(),
      notchMargin: 7,
      height: 68,
      padding: EdgeInsets.zero,
      elevation: 2,
      shadowColor: const Color(0x14000000),
      child: Row(children: [
        for (var i = 0; i < tabs.length; i++)
          Expanded(
            child: tabs[i].center
                ? InkResponse(
                    onTap: () => onSelect(i),
                    radius: 36,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: Text(tabs[i].label, textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11.5, fontWeight: i == index ? FontWeight.w700 : FontWeight.w500,
                              color: i == index ? AppColors.text : AppColors.muted)),
                    ),
                  )
                : _BarItem(page: tabs[i], selected: i == index, onTap: () => onSelect(i)),
          ),
      ]),
    );
  }
}

class _BarItem extends StatelessWidget {
  const _BarItem({required this.page, required this.selected, required this.onTap});
  final AppPage page;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 36,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: selected ? AppColors.yellowSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Icon(selected ? page.selectedIcon : page.icon, size: 22, color: selected ? AppColors.black : AppColors.muted),
        ),
        const SizedBox(height: 3),
        Text(page.label, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.text : AppColors.muted)),
      ]),
    );
  }
}

/// The round black button in the middle of the bottom bar.
class _CenterButton extends StatelessWidget {
  const _CenterButton({required this.page, required this.selected, required this.onTap});
  final AppPage page;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: page.label,
      child: Material(
        color: AppColors.black,
        shape: CircleBorder(side: BorderSide(color: selected ? Tw.pahangYellow : AppColors.black, width: 2)),
        elevation: 4,
        shadowColor: const Color(0x55000000),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 60,
            height: 60,
            child: Icon(selected ? page.selectedIcon : page.icon, color: Tw.pahangYellow, size: 28),
          ),
        ),
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

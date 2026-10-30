import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../navigation.dart';
import '../theme.dart';
import '../widgets/app_menu.dart';
import '../widgets/common.dart';
import '../widgets/web_push_card.dart';
import 'permohonan_screen.dart' show formLabel;
import 'perlu_tindakan_screen.dart';
import 'pengumuman_screen.dart';

/// Home tab: greeting header with summary cards, shortcuts, the next duty and
/// this year's numbers for the user's role.
class UtamaScreen extends StatefulWidget {
  const UtamaScreen({super.key, required this.onOpenTab, required this.onOpenNotifications, required this.onOpenEntry,
      required this.unread});
  final void Function(String id, {bool refresh}) onOpenTab;
  final VoidCallback onOpenNotifications;
  final Future<void> Function(MenuEntry entry) onOpenEntry;
  final int unread;

  @override
  State<UtamaScreen> createState() => _UtamaScreenState();
}

class _Home {
  /// /api/portal-dashboard.php data for Pengadil, Penilai and PP Daerah.
  Map<String, dynamic>? dashboard;
  Map<String, dynamic>? adminStats;
  List<Map<String, dynamic>>? gaps;
  List<Map<String, dynamic>>? announcements;
  String? photo;

  Map<String, dynamic> get totals => Map<String, dynamic>.from(dashboard?['totals'] as Map? ?? {});
}

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

int _int(Object? value) => int.tryParse('${value ?? ''}') ?? 0;

/// Third yearly-summary edge colour, between the yellow and the black.
const _gold = Color(0xFFC99A00);

class _UtamaScreenState extends State<UtamaScreen> {
  SessionUser get user => Api.instance.user.value!;

  String? get _view => switch (user.role) {
        'PP Daerah' => 'pp',
        'Penilai' => 'ra',
        'Admin' => null,
        _ => 'pengadil',
      };

  Future<_Home> _load() async {
    final home = _Home();
    Future<Map<String, dynamic>?> get(String path, [Map<String, dynamic>? q]) =>
        Api.instance.get(path, q).then<Map<String, dynamic>?>((v) => v).catchError((_) => null);
    final results = await Future.wait([
      get('/api/get-user-profile.php'),
      if (_view != null) get('/api/portal-dashboard.php', {'view': _view}) else Future.value(null),
      if (user.isAdmin) get('/api/admin-dashboard-stats.php') else Future.value(null),
      if (user.managesAppointments) get('/api/lantikan-perlu-tindakan.php') else Future.value(null),
      get('/api/announcements.php'),
    ]);
    home.photo = (results[0]?['user'] as Map?)?['url_gambar_profil'] as String?;
    home.dashboard = results[1]?['data'] == null ? null : Map<String, dynamic>.from(results[1]!['data'] as Map);
    home.adminStats = results[2]?['stats'] == null ? null : Map<String, dynamic>.from(results[2]!['stats'] as Map);
    home.gaps = results[3] == null ? null : _rows(results[3]!['data']);
    home.announcements = results[4] == null ? null : _rows(results[4]!['announcements']).take(3).toList();
    return home;
  }

  void _openMenu(_Home home) => Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => MenuScreen(user: user, onOpen: widget.onOpenEntry, badges: _badges(home))));

  /// Pending counts shown on quick-action icons, keyed by shell page id.
  Map<String?, int> _badges(_Home home) {
    final t = home.totals;
    return {
      'tugasan': _int(t['response']),
      'semakan': _int(t['pending_units']) + _int(t['review_applications']),
      'laporan': _int(t['needs_report']),
      'kelulusan': _int(home.adminStats?['pending_applications']),
    };
  }

  Future<void> _openGaps(Future<void> Function() reload) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PerluTindakanScreen()));
    if (mounted) await reload();
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<_Home>(
      load: _load,
      builder: (context, home, reload) {
        // Dark status-bar icons over the yellow header.
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.dark,
          child: RefreshIndicator(
          color: AppColors.black,
          backgroundColor: Tw.pahangYellow,
          onRefresh: reload,
          child: ListView(padding: EdgeInsets.zero, physics: const AlwaysScrollableScrollPhysics(), children: [
            _header(home, reload),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const WebPushCard(),
                SectionTitle('Tindakan Pantas', action: 'Lihat semua', onAction: () => _openMenu(home)),
                _quickActions(home),
                ..._focus(home, reload),
                ..._summary(home),
                if (user.isAdmin && home.adminStats != null) ..._adminPending(home.adminStats!),
                SectionTitle('Pengumuman', action: 'Lihat semua', onAction: () async {
                  await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => const PengumumanScreen()));
                  if (context.mounted) await reload();
                }),
                if (home.announcements == null)
                  AppCard(child: Column(children: [
                    const Text('Pengumuman tidak dapat dimuatkan.'),
                    TextButton(onPressed: reload, child: const Text('Cuba lagi')),
                  ]))
                else if (home.announcements!.isEmpty)
                  const AppCard(child: Text('Tiada pengumuman.'))
                else
                  AppCard(padding: EdgeInsets.zero, child: Column(children: [
                    for (final item in home.announcements!) AnnouncementTile(item: item, onTap: () async {
                      await openAnnouncement(context, int.parse('${item['id']}'));
                      if (context.mounted) await reload();
                    }),
                  ])),
              ]),
            ),
          ]),
          ),
        );
      },
    );
  }

  Widget _header(_Home home, Future<void> Function() reload) {
    final first = user.name.split(RegExp(r'\s+')).firstWhere((w) => w.isNotEmpty, orElse: () => '');
    return HeroHeader(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 4, 20),
          child: Row(children: [
            // The avatar opens the profile and settings.
            Semantics(
              button: true,
              label: 'Profil dan tetapan',
              child: GestureDetector(
                onTap: () => widget.onOpenTab('profil'),
                child: Stack(clipBehavior: Clip.none, children: [
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: Avatar(name: user.name, photo: home.photo, radius: 25, dark: true),
                  ),
                  Positioned(
                    right: -4,
                    bottom: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle,
                          border: Border.all(color: AppColors.black, width: 1.5)),
                      child: const Icon(Icons.settings_outlined, size: 14, color: AppColors.black),
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Hi, ${first.isEmpty ? 'Pengguna' : _title(first)}',
                    style: const TextStyle(color: Color(0xB8111111), fontSize: 14, fontWeight: FontWeight.w500)),
                Text(greeting(), style: const TextStyle(color: AppColors.black, fontSize: 21, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Pill(user.jenisPengadil.isNotEmpty && user.jenisPengadil != 'null' ? user.jenisPengadil : user.role,
                    (AppColors.black, Tw.pahangYellow)),
              ]),
            ),
            IconButton(
              tooltip: 'Notifikasi',
              onPressed: widget.onOpenNotifications,
              icon: Badge(
                isLabelVisible: widget.unread > 0,
                backgroundColor: Tw.red600,
                label: Text(widget.unread > 9 ? '9+' : '${widget.unread}'),
                child: const Icon(Icons.notifications_none_rounded, color: AppColors.black, size: 26),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(children: [
            for (final (i, card) in _cards(home, reload).indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(child: card),
            ],
          ]),
        ),
      ]),
    );
  }

  static String _title(String word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}';

  List<Widget> _cards(_Home home, Future<void> Function() reload) {
    final t = home.totals;
    final n = home.dashboard == null ? null : t;
    final gaps = home.gaps?.length;
    final cards = switch (user.role) {
      'Admin' => [
          ('Permohonan', home.adminStats?['pending_applications'], Icons.pending_actions_rounded, () => widget.onOpenTab('kelulusan')),
          ('Laporan RA', home.adminStats?['pending_reports'], Icons.rate_review_outlined, () => widget.onOpenTab('lantikan')),
          ('Tindakan', gaps, Icons.warning_amber_rounded, () => _openGaps(reload)),
        ],
      'PP Daerah' => [
          ('Semakan', n?['pending_units'], Icons.fact_check_outlined, () => widget.onOpenTab('semakan')),
          ('Permohonan', n?['review_applications'], Icons.description_outlined, () => widget.onOpenTab('semakan')),
          ('Tindakan', gaps, Icons.warning_amber_rounded, () => _openGaps(reload)),
        ],
      'Penilai' => [
          ('Perlu Jawab', n?['response'], Icons.mark_email_unread_outlined, () => widget.onOpenTab('tugasan')),
          ('Perlu Laporan', n?['needs_report'], Icons.edit_note_rounded, () => widget.onOpenTab('laporan')),
          ('Draf', n?['drafts'], Icons.drafts_outlined, () => widget.onOpenTab('laporan')),
        ],
      _ => [
          ('Perlu Jawab', n?['response'], Icons.mark_email_unread_outlined, () => widget.onOpenTab('tugasan')),
          ('Menunggu', n?['pending'], Icons.hourglass_top_rounded, () => widget.onOpenTab('rekod')),
          ('Notifikasi', widget.unread, Icons.notifications_none_rounded, widget.onOpenNotifications),
        ],
    };
    return [
      for (final (label, value, icon, onTap) in cards)
        SummaryCard(label: label, value: value ?? '-', icon: icon, onTap: onTap),
    ];
  }

  /// Four-column grid of the role's main actions, like a banking app.
  Widget _quickActions(_Home home) {
    final badges = _badges(home);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 12),
      child: TileGrid(spacing: 2, runSpacing: 6, equalHeight: false, children: [
        for (final entry in quickMenuFor(user))
          MenuTile(label: entry.label, icon: entry.icon, external: entry.external, badge: badges[entry.page],
              onTap: () => widget.onOpenEntry(entry)),
      ]),
    );
  }

  /// The one thing to look at next: the next duty, or matches missing officials.
  List<Widget> _focus(_Home home, Future<void> Function() reload) {
    if (user.managesAppointments) {
      final gaps = home.gaps;
      if (gaps == null) return const [];
      return [
        SectionTitle(gaps.isEmpty ? 'Lantikan' : 'Perlu tindakan (${gaps.length})',
            action: gaps.isEmpty ? null : 'Semua', onAction: () => _openGaps(reload)),
        if (gaps.isEmpty)
          const AppCard(
            child: Row(children: [
              Icon(Icons.verified_rounded, color: Tw.emerald600),
              SizedBox(width: 12),
              Expanded(child: Text('Semua perlawanan 14 hari akan datang lengkap pegawai.',
                  style: TextStyle(color: AppColors.muted))),
            ]),
          )
        else
          for (final m in gaps.take(2)) GapCard(match: m, onDone: reload),
      ];
    }
    final upcoming = _rows(home.dashboard?['upcoming']);
    final next = upcoming.where((a) => a['status'] == 'Diterima').firstOrNull ?? upcoming.firstOrNull;
    return [
      SectionTitle('Tugasan Seterusnya', action: 'Semua', onAction: () => widget.onOpenTab('tugasan')),
      if (next == null)
        const AppCard(
          child: Row(children: [
            Icon(Icons.event_available_rounded, color: AppColors.faint),
            SizedBox(width: 12),
            Expanded(child: Text('Tiada tugasan akan datang.', style: TextStyle(color: AppColors.muted))),
          ]),
        )
      else
        _NextDuty(duty: next, onTap: () => widget.onOpenTab('tugasan')),
    ];
  }

  List<Widget> _summary(_Home home) {
    final t = home.totals;
    final year = home.dashboard?['year'] ?? DateTime.now().year;
    final stats = switch (user.role) {
      'Admin' => home.adminStats == null
          ? null
          : [
              ('Pengadil aktif', home.adminStats!['total_pengadil'], AppColors.yellow),
              ('Perlawanan bulan ini', home.adminStats!['matches_this_month'], AppColors.black),
              ('Permohonan', home.adminStats!['pending_applications'], _gold),
              ('Laporan RA', home.adminStats!['pending_reports'], AppColors.faint),
            ],
      'PP Daerah' => home.dashboard == null
          ? null
          : [
              ('Berdaftar', t['registered'], AppColors.yellow),
              ('Berlesen', t['licensed'], AppColors.black),
              ('Rekod', t['records'], _gold),
              ('Disahkan', t['verified'], AppColors.faint),
            ],
      'Penilai' => home.dashboard == null
          ? null
          : [
              ('Diterima', t['accepted'], AppColors.yellow),
              ('Tiada laporan', t['no_report'], AppColors.black),
              ('Dihantar', t['submitted'], _gold),
              ('Disahkan', t['confirmed'], AppColors.faint),
            ],
      _ => home.dashboard == null
          ? null
          : [
              ('Rekod', t['records'], AppColors.yellow),
              ('Disahkan', t['verified'], AppColors.black),
              ('Menunggu', t['pending'], _gold),
              ('Ditolak', t['rejected'], AppColors.faint),
            ],
    };
    if (stats == null) return const [];
    final minimum = _int(home.dashboard?['minimum_matches']);
    final verified = _int(t['verified']);
    return [
      SectionTitle(user.isAdmin ? 'Ringkasan' : 'Ringkasan $year'),
      Row(children: [
        for (final (i, (label, value, color)) in stats.indexed) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: MiniStat(label: label, value: value ?? 0, color: color)),
        ],
      ]),
      if (_view == 'pengadil' && minimum > 0) ...[
        const SizedBox(height: 12),
        AppCard(
          onTap: () => widget.onOpenTab('rekod'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Expanded(
                child: Text('Kelayakan perlawanan disahkan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ),
              Text('$verified / $minimum', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (verified / minimum).clamp(0, 1).toDouble(),
                minHeight: 8,
                backgroundColor: AppColors.grey100,
                color: verified >= minimum ? Tw.emerald500 : Tw.pahangYellow,
              ),
            ),
          ]),
        ),
      ],
    ];
  }

  List<Widget> _adminPending(Map<String, dynamic> s) {
    final byType = Map<String, dynamic>.from(s['applications_by_type'] as Map? ?? {});
    final pending = byType.entries.map((e) => (e.key, _int((e.value as Map)['pending']))).where((e) => e.$2 > 0).toList();
    if (pending.isEmpty) return const [];
    return [
      SectionTitle('Permohonan menunggu', action: 'Semak', onAction: () => widget.onOpenTab('kelulusan')),
      AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < pending.length; i++) ...[
            if (i > 0) const Divider(indent: 16, endIndent: 16),
            ListTile(
              onTap: () => widget.onOpenTab('kelulusan'),
              title: Text(formLabel(pending[i].$1), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              trailing: Pill('${pending[i].$2}', (AppColors.yellowSoft, AppColors.black)),
            ),
          ],
        ]),
      ),
    ];
  }
}

/// The next appointment, laid out like a check-in card: date and position,
/// then the time left before kick-off.
class _NextDuty extends StatelessWidget {
  const _NextDuty({required this.duty, required this.onTap});
  final Map<String, dynamic> duty;
  final VoidCallback onTap;

  String _remaining() {
    final kickoff = DateTime.tryParse(
        '${'${duty['date']}'.padRight(10).substring(0, 10)}T${formatTime(duty['time']) == '-' ? '00:00' : formatTime(duty['time'])}:00+08:00');
    if (kickoff == null) return '-';
    final left = kickoff.difference(DateTime.now());
    if (left.isNegative) return 'Sedang berlangsung';
    if (left.inDays > 0) return '${left.inDays} hari ${left.inHours % 24} jam';
    return '${left.inHours} jam ${left.inMinutes % 60} min';
  }

  @override
  Widget build(BuildContext context) {
    final pending = duty['status'] == 'Belum Jawab';
    Widget cell(IconData icon, String label, String value) => Row(children: [
          Icon(icon, size: 20, color: AppColors.muted),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.muted)),
              Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ]),
          ),
        ]);
    return AppCard(
      onTap: onTap,
      accent: pending ? Tw.pahangYellow : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Text(text(duty['title']), maxLines: 2,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ),
          if (pending) const Pill('Belum jawab', (Tw.amber50, Tw.amber700)),
        ]),
        const SizedBox(height: 2),
        Text(text(duty['tournament']), maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
        const Divider(height: 24),
        Row(children: [
          Expanded(child: cell(Icons.calendar_today_outlined, 'Tarikh', formatDate(duty['date']))),
          Container(width: 1, height: 32, color: AppColors.line, margin: const EdgeInsets.symmetric(horizontal: 12)),
          Expanded(child: cell(Icons.schedule_rounded, 'Masa', formatTime(duty['time']))),
        ]),
        const Divider(height: 24),
        cell(Icons.sports_outlined, 'Jawatan', text(duty['jawatan'])),
        const SizedBox(height: 12),
        cell(Icons.place_outlined, 'Tempat', text(duty['subtitle'])),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: AppColors.black, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Icon(Icons.timer_outlined, size: 18, color: Tw.pahangYellow),
            const SizedBox(width: 8),
            const Text('Masa berbaki', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white)),
            const Spacer(),
            Text(_remaining(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Tw.pahangYellow)),
          ]),
        ),
      ]),
    );
  }
}

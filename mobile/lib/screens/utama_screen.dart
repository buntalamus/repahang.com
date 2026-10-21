import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/web_push_card.dart';
import 'permohonan_screen.dart' show formLabel;
import 'perlu_tindakan_screen.dart';
import 'pengumuman_screen.dart';

/// Home tab: greeting header and what needs attention for this role.
class UtamaScreen extends StatefulWidget {
  const UtamaScreen({super.key, required this.onOpenTab, required this.onOpenNotifications, required this.unread});
  final void Function(String id, {bool refresh}) onOpenTab;
  final VoidCallback onOpenNotifications;
  final int unread;

  @override
  State<UtamaScreen> createState() => _UtamaScreenState();
}

class _Home {
  List<Map<String, dynamic>> appointments = [];
  Map<String, dynamic>? matchStats;
  Map<String, dynamic>? adminStats;
  int? ppPendingMatches;
  int? ppPendingApplications;
  int? adminPendingApplications;
  List<Map<String, dynamic>>? gaps;
  List<Map<String, dynamic>> notifications = [];
  List<Map<String, dynamic>>? announcements;
  String? photo;
}

class _UtamaScreenState extends State<UtamaScreen> {
  SessionUser get user => Api.instance.user.value!;

  Future<_Home> _load() async {
    final home = _Home();
    Future<Map<String, dynamic>?> get(String path, [Map<String, dynamic>? q]) =>
        Api.instance.get(path, q).then<Map<String, dynamic>?>((v) => v).catchError((_) => null);
    List<Map<String, dynamic>> rows(Object? list) =>
        (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final results = await Future.wait([
      get('/api/get-user-profile.php'),
      get('/api/notifications.php'),
      if (user.hasAssignments) get('/api/tugasan.php') else Future.value(null),
      if (user.role == 'Pengadil') get('/api/pengadil-matches.php', {'per_page': 1}) else Future.value(null),
      if (user.isDistrict) get('/api/pp-verify-match.php', {'status': 'pending', 'per_page': 1}) else Future.value(null),
      if (user.isDistrict) get('/api/pp-applications.php', {'type': 'pengesahan'}) else Future.value(null),
      if (user.isAdmin) get('/api/admin-dashboard-stats.php') else Future.value(null),
      if (user.managesAppointments) get('/api/lantikan-perlu-tindakan.php') else Future.value(null),
      get('/api/announcements.php'),
    ]);
    home.photo = (results[0]?['user'] as Map?)?['url_gambar_profil'] as String?;
    home.notifications = rows(results[1]?['notifications']).take(3).toList();
    home.appointments = rows(results[2]?['data']);
    home.matchStats = results[3]?['statistics'] == null ? null : Map<String, dynamic>.from(results[3]!['statistics'] as Map);
    home.ppPendingMatches = (results[4]?['statistics'] as Map?)?['pending'] == null
        ? null
        : int.tryParse('${(results[4]!['statistics'] as Map)['pending']}');
    home.ppPendingApplications = results[5] == null ? null : rows(results[5]!['applications'] ?? results[5]!['data']).length;
    home.adminStats = results[6]?['stats'] == null ? null : Map<String, dynamic>.from(results[6]!['stats'] as Map);
    home.adminPendingApplications = int.tryParse('${home.adminStats?['pending_applications'] ?? ''}');
    home.gaps = results[7] == null ? null : rows(results[7]!['data']);
    home.announcements = results[8] == null ? null : rows(results[8]!['announcements']).take(3).toList();
    return home;
  }

  bool _started(Map<String, dynamic> a) {
    final kickoff = DateTime.tryParse('${'${a['tarikh']}'.padRight(10).substring(0, 10)}T${text(a['masa'], '00:00:00')}+08:00');
    return kickoff != null && !kickoff.isAfter(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<_Home>(
      load: _load,
      builder: (context, home, reload) {
        final pending = home.appointments.where((a) => a['status'] == 'Belum Jawab' && !_started(a)).toList();
        final upcoming = home.appointments
            .where((a) => a['status'] == 'Diterima' && !_started(a))
            .toList()
          ..sort((a, b) => '${a['tarikh']} ${a['masa']}'.compareTo('${b['tarikh']} ${b['masa']}'));
        return RefreshIndicator(
          color: AppColors.black,
          backgroundColor: Tw.pahangYellow,
          onRefresh: reload,
          child: ListView(padding: EdgeInsets.zero, physics: const AlwaysScrollableScrollPhysics(), children: [
            _header(home),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const WebPushCard(),
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
                if (user.hasAssignments) ..._officialSection(pending, upcoming),
                if (user.role == 'Pengadil' && home.matchStats != null) _matchProgress(home.matchStats!),
                if (home.gaps != null) _gapSection(home.gaps!),
                if (user.isDistrict) _districtTiles(home),
                if (user.isAdmin && home.adminStats != null) ..._adminSection(home.adminStats!),
                if (home.notifications.isNotEmpty) ...[
                  SectionTitle('Notifikasi terkini', action: 'Lihat semua', onAction: widget.onOpenNotifications),
                  AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(children: [
                      for (var i = 0; i < home.notifications.length; i++) ...[
                        if (i > 0) const Divider(indent: 16, endIndent: 16),
                        ListTile(
                          onTap: widget.onOpenNotifications,
                          leading: Icon(
                            '${home.notifications[i]['is_read']}' == '1'
                                ? Icons.notifications_none_rounded
                                : Icons.notifications_active_rounded,
                            color: '${home.notifications[i]['is_read']}' == '1' ? AppColors.faint : AppColors.black,
                          ),
                          title: Text(text(home.notifications[i]['subject']),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          subtitle: Text(text(home.notifications[i]['created_at']),
                              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                        ),
                      ],
                    ]),
                  ),
                ],
              ]),
            ),
          ]),
        );
      },
    );
  }

  Widget _header(_Home home) {
    final first = user.name.split(RegExp(r'\s+')).firstWhere((w) => w.isNotEmpty, orElse: () => '');
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.black,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 12, 28),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(2),
              decoration: const BoxDecoration(color: Tw.pahangYellow, shape: BoxShape.circle),
              child: Avatar(name: user.name, photo: home.photo, radius: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${greeting()},', style: const TextStyle(color: Colors.white70, fontSize: 14)),
                Text(first.isEmpty ? 'Pengguna' : _title(first),
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Pill(user.jenisPengadil.isNotEmpty && user.jenisPengadil != 'null' ? user.jenisPengadil : user.role,
                    (Tw.pahangYellow, AppColors.black)),
              ]),
            ),
            IconButton(
              onPressed: widget.onOpenNotifications,
              icon: Badge(
                isLabelVisible: widget.unread > 0,
                backgroundColor: Tw.red600,
                label: Text(widget.unread > 9 ? '9+' : '${widget.unread}'),
                child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 28),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  static String _title(String word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}';

  List<Widget> _officialSection(List<Map<String, dynamic>> pending, List<Map<String, dynamic>> upcoming) {
    return [
      if (pending.isNotEmpty) ...[
        SectionTitle('Perlu jawapan anda', action: 'Jawab', onAction: () => widget.onOpenTab('tugasan')),
        AppCard(
          accent: Tw.pahangYellow,
          onTap: () => widget.onOpenTab('tugasan'),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: Tw.amber50, shape: BoxShape.circle),
              child: Text('${pending.length}',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Tw.amber700)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${pending.length} lantikan belum dijawab',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text('${text(pending.first['pasukan_home'])} vs ${text(pending.first['pasukan_away'])}',
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
          ]),
        ),
      ],
      SectionTitle('Tugasan seterusnya', action: 'Semua', onAction: () => widget.onOpenTab('tugasan')),
      if (upcoming.isEmpty)
        const AppCard(
          child: Row(children: [
            Icon(Icons.event_available_rounded, color: AppColors.faint),
            SizedBox(width: 12),
            Expanded(child: Text('Tiada tugasan akan datang.', style: TextStyle(color: AppColors.muted))),
          ]),
        )
      else
        AppCard(
          onTap: () => widget.onOpenTab('tugasan'),
          child: Row(children: [
            DateBlock(upcoming.first['tarikh'], highlight: true),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${formatTime(upcoming.first['masa'])} · ${text(upcoming.first['jawatan'])}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
                const SizedBox(height: 2),
                Text('${text(upcoming.first['pasukan_home'])} vs ${text(upcoming.first['pasukan_away'])}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Row(children: [
                  const Icon(Icons.place_outlined, size: 14, color: AppColors.muted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(text(upcoming.first['tempat']), maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                  ),
                ]),
              ]),
            ),
          ]),
        ),
    ];
  }

  Widget _matchProgress(Map<String, dynamic> s) {
    final verified = int.tryParse('${s['verified_year'] ?? 0}') ?? 0;
    final minimum = int.tryParse('${s['minimum_required'] ?? 20}') ?? 20;
    final done = verified >= minimum;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle('Perlawanan ${text(s['year'], '')}', action: 'Rekod', onAction: () => widget.onOpenTab('rekod')),
      AppCard(
        onTap: () => widget.onOpenTab('rekod'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('$verified', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, height: 1)),
            Text(' / $minimum disahkan', style: const TextStyle(fontSize: 15, color: AppColors.muted)),
            const Spacer(),
            if (done) const Pill('Layak', (Tw.green100, Tw.green700), icon: Icons.check_rounded),
          ]),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: minimum == 0 ? 1 : (verified / minimum).clamp(0, 1).toDouble(),
              minHeight: 10,
              backgroundColor: AppColors.background,
              color: done ? Tw.emerald500 : Tw.pahangYellow,
            ),
          ),
          const SizedBox(height: 10),
          Text('Menunggu pengesahan: ${text(s['pending_year'], '0')}',
              style: const TextStyle(fontSize: 13, color: AppColors.muted)),
        ]),
      ),
    ]);
  }

  Widget _gapSection(List<Map<String, dynamic>> gaps) {
    if (gaps.isEmpty) {
      return const AppCard(
        child: Row(children: [
          Icon(Icons.verified_rounded, color: Tw.emerald600),
          SizedBox(width: 12),
          Expanded(child: Text('Semua perlawanan 14 hari akan datang lengkap pegawai.', style: TextStyle(color: AppColors.muted))),
        ]),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle('Perlu tindakan (${gaps.length})', action: 'Semua', onAction: () =>
          Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PerluTindakanScreen()))),
      for (final m in gaps.take(3)) GapCard(match: m),
    ]);
  }

  Widget _districtTiles(_Home home) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('Perlu tindakan PP Daerah'),
      Row(children: [
        Expanded(
          child: StatTile(label: 'Rekod perlawanan menunggu pengesahan', value: home.ppPendingMatches ?? '-',
              icon: Icons.fact_check_outlined, color: Tw.amber600, onTap: () => widget.onOpenTab('semakan')),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatTile(label: 'Permohonan menunggu semakan', value: home.ppPendingApplications ?? '-',
              icon: Icons.description_outlined, color: Tw.blue600, onTap: () => widget.onOpenTab('semakan')),
        ),
      ]),
      const SizedBox(height: 4),
    ]);
  }

  List<Widget> _adminSection(Map<String, dynamic> s) {
    final byType = Map<String, dynamic>.from(s['applications_by_type'] as Map? ?? {});
    final pending = byType.entries
        .map((e) => (e.key, int.tryParse('${(e.value as Map)['pending']}') ?? 0))
        .where((e) => e.$2 > 0)
        .toList();
    return [
      const SectionTitle('Ringkasan'),
      Row(children: [
        Expanded(
          child: StatTile(label: 'Permohonan menunggu', value: s['pending_applications'], icon: Icons.pending_actions,
              color: Tw.amber600, onTap: () => widget.onOpenTab('kelulusan')),
        ),
        const SizedBox(width: 12),
        Expanded(child: StatTile(label: 'Pengadil aktif', value: s['total_pengadil'], icon: Icons.sports, color: Tw.blue600)),
      ]),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(
          child: StatTile(label: 'Laporan RA menunggu', value: s['pending_reports'], icon: Icons.rate_review_outlined,
              color: Tw.purple600),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatTile(label: 'Perlawanan bulan ini', value: s['matches_this_month'], icon: Icons.sports_soccer,
              color: Tw.emerald600),
        ),
      ]),
      if (pending.isNotEmpty) ...[
        SectionTitle('Permohonan menunggu', action: 'Semak', onAction: () => widget.onOpenTab('kelulusan')),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (var i = 0; i < pending.length; i++) ...[
              if (i > 0) const Divider(indent: 16, endIndent: 16),
              ListTile(
                onTap: () => widget.onOpenTab('kelulusan'),
                title: Text(formLabel(pending[i].$1), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                trailing: Pill('${pending[i].$2}', (Tw.yellow100, Tw.yellow800)),
              ),
            ],
          ]),
        ),
      ],
    ];
  }
}

import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'tambah_perlawanan_screen.dart';

/// Referee's records: match history (/api/pengadil-matches.php) and
/// assessment reports (/api/pengadil-penilaian.php).
class RekodScreen extends StatefulWidget {
  const RekodScreen({super.key});

  @override
  State<RekodScreen> createState() => _RekodScreenState();
}

class _RekodScreenState extends State<RekodScreen> {
  String _segment = 'perlawanan';
  final _matches = GlobalKey<_MatchListState>();

  Future<void> _add() async {
    final message = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const TambahPerlawananScreen()));
    if (message == null || !mounted) return;
    showToast(context, message);
    await _matches.currentState?.refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: _segment == 'perlawanan'
          ? FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.add_rounded), label: const Text('Tambah'))
          : null,
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: SizedBox(
            width: double.infinity,
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'perlawanan', label: Text('Perlawanan'), icon: Icon(Icons.sports_soccer, size: 18)),
                ButtonSegment(value: 'penilaian', label: Text('Penilaian'), icon: Icon(Icons.grading, size: 18)),
              ],
              selected: {_segment},
              onSelectionChanged: (value) => setState(() => _segment = value.first),
            ),
          ),
        ),
        Expanded(
          child: IndexedStack(index: _segment == 'perlawanan' ? 0 : 1, children: [
            _MatchList(key: _matches),
            const _AssessmentList(),
          ]),
        ),
      ]),
    );
  }
}

class _MatchList extends StatefulWidget {
  const _MatchList({super.key});

  @override
  State<_MatchList> createState() => _MatchListState();
}

class _MatchListState extends State<_MatchList> {
  static const _perPage = 20;
  final _items = <Map<String, dynamic>>[];
  Map<String, dynamic>? _stats;
  int _page = 0;
  int _pages = 1;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    _items.clear();
    _page = 0;
    _pages = 1;
    await _more();
  }

  Future<void> _more() async {
    if (_loading || _page >= _pages) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = await Api.instance.get('/api/pengadil-matches.php', {'page': _page + 1, 'per_page': _perPage});
      _items.addAll((body['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)));
      _stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
      _pages = ((body['pagination'] as Map?)?['total_pages'] as num?)?.toInt() ?? 1;
      _page += 1;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _items.isEmpty) {
      return EmptyState(icon: Icons.cloud_off_rounded, title: 'Tidak dapat dimuatkan', subtitle: _error,
          actionLabel: 'Cuba semula', onAction: refresh);
    }
    if (_stats == null) return const Loading();
    final s = _stats!;
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _more();
        return false;
      },
      child: RefreshList(onRefresh: refresh, bottomPadding: 96, children: [
        Row(children: [
          Expanded(child: StatTile(label: 'Disahkan ${text(s['year'], '')}', value: s['verified_year'],
              icon: Icons.check_circle_outline, color: Tw.emerald600)),
          const SizedBox(width: 10),
          Expanded(child: StatTile(label: 'Menunggu', value: s['pending_year'], icon: Icons.schedule, color: Tw.amber600)),
          const SizedBox(width: 10),
          Expanded(child: StatTile(label: 'Ditolak', value: s['rejected_year'], icon: Icons.cancel_outlined, color: Tw.rose600)),
        ]),
        const SizedBox(height: 8),
        const SectionTitle('Sejarah perlawanan'),
        if (_items.isEmpty) const EmptyState(icon: Icons.sports_soccer, title: 'Tiada rekod perlawanan'),
        for (final m in _items) _card(m),
        if (_loading) const Loading(),
      ]),
    );
  }

  Widget _card(Map<String, dynamic> m) {
    final status = text(m['status_pp'], 'Belum Disahkan');
    final score = m['skor_ft_home'] != null && m['skor_ft_away'] != null ? '${m['skor_ft_home']} - ${m['skor_ft_away']}' : null;
    return AppCard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DateBlock(m['tarikh']),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${text(m['jawatan'])}${m['lantikan_id'] != null ? ' · Lantikan rasmi' : ''}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
            const SizedBox(height: 2),
            Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text('${text(m['jenis'])} · ${text(m['tempat'])}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            if (text(m['catatan_pp'], '').isNotEmpty)
              Text('PP: ${m['catatan_pp']}', style: const TextStyle(fontSize: 12, color: Tw.rose700)),
          ]),
        ),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Pill(status == 'Belum Disahkan' ? 'Menunggu' : status, matchTone(status)),
          if (score != null) ...[
            const SizedBox(height: 8),
            Text(score, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ]),
      ]),
    );
  }
}

Tone markahTone(Object? raw) {
  final m = double.tryParse('${raw ?? ''}');
  if (m == null || m == 0) return (Tw.gray100, Tw.gray500);
  if (m >= 8.3) return (Tw.green100, Tw.green700);
  if (m >= 8.0) return (Tw.blue100, Tw.blue700);
  if (m >= 7.5) return (Tw.yellow100, Tw.yellow700);
  return (Tw.red100, Tw.red700);
}

class _AssessmentList extends StatelessWidget {
  const _AssessmentList();

  void _open(BuildContext context, Map<String, dynamic> report) {
    showAppSheet<void>(context, builder: (context) => AsyncView<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(
          (await Api.instance.get('/api/pengadil-penilaian.php', {'id': report['id']}))['data'] as Map),
      builder: (context, d, _) {
        final mine = Map<String, dynamic>.from(d['my_entry'] as Map? ?? {});
        final tone = markahTone(mine['markah']);
        Widget section(String title, String prefix) {
          final rows = [
            (Icons.thumb_up_alt_outlined, 'Kekuatan', mine['${prefix}_kekuatan']),
            (Icons.trending_down_rounded, 'Kelemahan', mine['${prefix}_kelemahan']),
            (Icons.lightbulb_outline, 'Nasihat', mine['${prefix}_nasihat']),
          ].where((r) => text(r.$3, '').isNotEmpty).toList();
          if (rows.isEmpty) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            for (final (icon, label, value) in rows) DetailRow(icon, label, text(value)),
          ]);
        }

        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: tone.$1, shape: BoxShape.circle),
              child: Text(text(mine['markah']), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: tone.$2)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(mine['prestasi']), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: tone.$2)),
                Text('${text(d['pasukan_home'])} vs ${text(d['pasukan_away'])}',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text('${formatDate(d['tarikh'])} · ${text(mine['jawatan'])}',
                    style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ]),
            ),
          ]),
          const SizedBox(height: 8),
          DetailRow(Icons.person_outline, 'Penilai', text(d['nama_penilai'])),
          DetailRow(Icons.speed_rounded, 'Tahap kesukaran', text(d['tahap_kesukaran'])),
          section('Kawalan perlawanan', 'kawalan'),
          section('Kecergasan fizikal', 'fizikal'),
          section('Kerjasama', 'kerjasama'),
          if (text(d['ulasan_keseluruhan'], '').isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Ulasan keseluruhan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(text(d['ulasan_keseluruhan']), style: const TextStyle(fontSize: 14, height: 1.5)),
          ],
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => openWebsite(context, '/pengadil/penilaian'),
            icon: const Icon(Icons.picture_as_pdf_outlined),
            label: const Text('PDF di website'),
          ),
        ]);
      },
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      load: () async => ((await Api.instance.get('/api/pengadil-penilaian.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      builder: (context, reports, reload) {
        final marks = reports.map((r) => double.tryParse('${r['my_markah'] ?? ''}')).whereType<double>().toList();
        final average = marks.isEmpty ? null : marks.reduce((a, b) => a + b) / marks.length;
        return RefreshList(onRefresh: reload, children: [
          Row(children: [
            Expanded(child: StatTile(label: 'Laporan disahkan', value: reports.length, icon: Icons.description_outlined)),
            const SizedBox(width: 12),
            Expanded(
              child: StatTile(label: 'Purata markah', value: average?.toStringAsFixed(1) ?? '-', icon: Icons.star_outline_rounded,
                  color: markahTone(average).$2),
            ),
          ]),
          const SizedBox(height: 8),
          const SectionTitle('Laporan penilaian'),
          if (reports.isEmpty) const EmptyState(icon: Icons.grading, title: 'Tiada laporan penilaian'),
          for (final r in reports)
            AppCard(
              onTap: () => _open(context, r),
              child: Row(children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: markahTone(r['my_markah']).$1, shape: BoxShape.circle),
                  child: Text(text(r['my_markah']),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: markahTone(r['my_markah']).$2)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${text(r['pasukan_home'])} vs ${text(r['pasukan_away'])}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text('${formatDate(r['tarikh'])} · ${text(r['my_jawatan'])}',
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                    Text(text(r['my_prestasi']), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                        color: markahTone(r['my_markah']).$2)),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
              ]),
            ),
        ]);
      },
    );
  }
}

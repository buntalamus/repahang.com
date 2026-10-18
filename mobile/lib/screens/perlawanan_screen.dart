import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'tambah_perlawanan_screen.dart';

/// Match records, following features/pengadil/matches (stats cards + list).
class PerlawananScreen extends StatefulWidget {
  const PerlawananScreen({super.key});

  @override
  State<PerlawananScreen> createState() => _PerlawananScreenState();
}

class _PerlawananScreenState extends State<PerlawananScreen> {
  static const _perPage = 20;
  final _matches = <Map<String, dynamic>>[];
  Map<String, dynamic>? _stats;
  int _page = 0;
  int _totalPages = 1;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    _matches.clear();
    _page = 0;
    _totalPages = 1;
    await _more();
  }

  Future<void> _more() async {
    if (_loading || _page >= _totalPages) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = await Api.instance.get('/api/pengadil-matches.php', {'page': _page + 1, 'per_page': _perPage});
      _matches.addAll((body['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)));
      _stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
      _totalPages = ((body['pagination'] as Map?)?['total_pages'] as num?)?.toInt() ?? 1;
      _page += 1;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    final message = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const TambahPerlawananScreen()));
    if (message == null || !mounted) return;
    showToast(context, message);
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _matches.isEmpty) {
      return ListView(padding: const EdgeInsets.all(16), children: [
        EmptyCard(icon: Icons.cloud_off, message: _error!, actionLabel: 'Cuba semula', onAction: _refresh),
      ]);
    }
    if (_stats == null) return const Loading(message: 'Memuatkan perlawanan...');
    return RefreshIndicator(
      color: Tw.pahangBlack,
      onRefresh: _refresh,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _more();
          return false;
        },
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _matches.length + 2,
          itemBuilder: (context, index) {
            if (index == 0) return _header();
            if (index == _matches.length + 1) {
              if (_loading) return const Loading();
              if (_matches.isEmpty) return const EmptyCard(icon: Icons.sports_soccer, message: 'Tiada rekod perlawanan.');
              return const SizedBox(height: 24);
            }
            return _matchCard(index, _matches[index - 1]);
          },
        ),
      ),
    );
  }

  Widget _header() {
    final s = _stats!;
    final year = text(s['year']);
    Widget stat(IconData icon, Color bg, Color fg, Object? value, String label) => Expanded(
          child: WebCard(
            margin: EdgeInsets.zero,
            borderColor: Colors.transparent,
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${value ?? 0}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                  Text(label, style: const TextStyle(fontSize: 12, color: Tw.gray500)),
                ]),
              ),
            ]),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        stat(Icons.sports_soccer, Tw.blue100, Tw.blue600, s['current_year'], 'Perlawanan Tahun $year'),
        const SizedBox(width: 12),
        stat(Icons.check_circle, Tw.green100, Tw.green600, s['verified_year'], 'Disahkan Tahun $year'),
      ]),
      const SizedBox(height: 12),
      Row(children: [
        stat(Icons.schedule, Tw.yellow100, Tw.yellow600, s['pending_year'], 'Belum Disahkan Tahun $year'),
        const SizedBox(width: 12),
        stat(Icons.cancel, Tw.red100, Tw.rose800, s['rejected_year'], 'Tidak Disahkan Tahun $year'),
      ]),
      const SizedBox(height: 16),
      WebCard(
        borderColor: Colors.transparent,
        child: Row(children: [
          const Expanded(
            child: Text('Rekod perlawanan yang anda hantar akan disahkan oleh PP Daerah.',
                style: TextStyle(fontSize: 13, color: Tw.slate600)),
          ),
          const SizedBox(width: 12),
          YellowButton(label: 'Tambah Perlawanan', icon: Icons.add, onPressed: _add),
        ]),
      ),
    ]);
  }

  Widget _matchCard(int index, Map<String, dynamic> m) {
    final status = text(m['status_pp'], 'Belum Disahkan');
    final hasScore = m['skor_ft_home'] != null && m['skor_ft_away'] != null;
    String score(String key) => m['skor_${key}_home'] != null ? '${m['skor_${key}_home']}-${m['skor_${key}_away']}' : '';
    const small = TextStyle(fontSize: 12, color: Tw.gray500);
    return WebCard(
      borderColor: Colors.transparent,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('$index', style: const TextStyle(color: Tw.gray500, fontSize: 13)),
          const SizedBox(width: 12),
          Expanded(
            child: Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
              if (m['lantikan_id'] != null) _tag('Lantikan Rasmi', Tw.blue50, Tw.blue600, Tw.blue200),
              if (m['match_group_id'] != null) _tag('Kumpulan', Tw.purple50, Tw.purple600, Tw.purple200),
            ]),
          ),
          const SizedBox(width: 8),
          StatusBadge(status, matchTone(status), pill: true),
        ]),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.only(left: 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (hasScore)
              Text.rich(TextSpan(children: [
                TextSpan(text: score('ft'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Tw.gray900)),
                if (score('ht').isNotEmpty) TextSpan(text: '   HT: ${score('ht')}'),
                if (score('et').isNotEmpty) TextSpan(text: '   ET: ${score('et')}'),
                if (score('ps').isNotEmpty) TextSpan(text: '   PS: ${score('ps')}'),
              ]), style: const TextStyle(fontSize: 12, color: Tw.gray400)),
            Text('${text(m['jenis'])} · ${text(m['tarikh'])} ${text(m['masa'], '')}', style: small),
            Text('${text(m['tempat'])}${text(m['daerah_perlawanan_nama'], '').isEmpty ? '' : ' · ${m['daerah_perlawanan_nama']}'}',
                style: small),
            Text('Jawatan: ${text(m['jawatan'])}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Tw.slate700)),
            if (text(m['catatan_pp'], '').isNotEmpty)
              Text('Catatan PP: ${m['catatan_pp']}', style: small),
          ]),
        ),
      ]),
    );
  }

  Widget _tag(String label, Color bg, Color fg, Color border) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: bg, border: Border.all(color: border), borderRadius: BorderRadius.circular(4)),
        child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: fg)),
      );
}

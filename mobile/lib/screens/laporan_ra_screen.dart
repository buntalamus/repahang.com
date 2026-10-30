import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'laporan_form_screen.dart';

/// Assessor (RA) duties: accepted "Penilai Pengadil" appointments with their
/// report status; reports are filled in LaporanFormScreen.
class LaporanRaScreen extends StatefulWidget {
  const LaporanRaScreen({super.key});

  @override
  State<LaporanRaScreen> createState() => _LaporanRaScreenState();
}

class _LaporanRaScreenState extends State<LaporanRaScreen> {
  final _view = GlobalKey<AsyncViewState<(List<Map<String, dynamic>>, List<Map<String, dynamic>>)>>();

  Future<void> _open(Map<String, dynamic> a, Map<String, dynamic>? report) async {
    final message = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => LaporanFormScreen(assignment: a, report: report)));
    if (mounted && message != null) showToast(context, message);
    await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<(List<Map<String, dynamic>>, List<Map<String, dynamic>>)>(
      key: _view,
      load: () async {
        final results = await Future.wait([
          Api.instance.get('/api/tugasan.php'),
          Api.instance.get('/api/laporan-penilaian.php', {'penilai': 1}),
        ]);
        List<Map<String, dynamic>> rows(Map<String, dynamic> body) =>
            (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        final duties = rows(results[0]).where((a) => a['status'] == 'Diterima' && a['jawatan'] == 'Penilai Pengadil').toList()
          ..sort((a, b) => '${b['tarikh']}'.compareTo('${a['tarikh']}'));
        return (duties, rows(results[1]));
      },
      builder: (context, data, reload) {
        final (duties, reports) = data;
        Map<String, dynamic>? reportFor(Map<String, dynamic> a) =>
            reports.where((r) => '${r['lantikan_id']}' == '${a['id']}').firstOrNull;
        final unfinished = duties.where((a) => reportFor(a) == null || reportFor(a)!['status'] == 'Draf').length;
        return RefreshList(onRefresh: reload, children: [
          Row(children: [
            Expanded(child: StatTile(label: 'Laporan belum dihantar', value: unfinished, icon: Icons.edit_note_rounded,
                color: unfinished > 0 ? Tw.amber600 : Tw.emerald600)),
            const SizedBox(width: 12),
            Expanded(child: StatTile(label: 'Tugasan penilaian', value: duties.length, icon: Icons.rate_review_outlined)),
          ]),
          const SizedBox(height: 8),
          const SectionTitle('Perlawanan dinilai'),
          if (duties.isEmpty) const EmptyState(icon: Icons.rate_review_outlined, title: 'Tiada tugasan penilaian'),
          for (final a in duties) _card(a, reportFor(a)),
        ]);
      },
    );
  }

  Widget _card(Map<String, dynamic> a, Map<String, dynamic>? report) {
    final status = report == null ? 'Belum diisi' : text(report['status']);
    final tone = switch (status) {
      'Disahkan' => (Tw.green100, Tw.green700),
      'Dihantar' => (Tw.blue100, Tw.blue700),
      'Ditolak' => (Tw.red100, Tw.red700),
      'Draf' => (Tw.gray100, Tw.gray600),
      _ => (Tw.amber50, Tw.amber700),
    };
    final needsWork = report == null || report['status'] == 'Draf';
    return AppCard(
      accent: needsWork ? Tw.pahangYellow : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          DateBlock(a['tarikh'], highlight: needsWork),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(a['nama_kejohanan']), maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
              Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              Text('${formatTime(a['masa'])} · ${text(a['tempat'])}', maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ]),
          ),
          Pill(status, tone),
        ]),
        if (report != null && text(report['catatan_admin'], '').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('Catatan Admin: ${report['catatan_admin']}', style: const TextStyle(fontSize: 13, color: Tw.rose700)),
        ],
        if (needsWork) ...[
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => _open(a, report),
            icon: const Icon(Icons.edit_note_rounded, size: 20),
            label: Text(report == null ? 'Isi laporan' : 'Sambung draf'),
          ),
        ],
      ]),
    );
  }
}

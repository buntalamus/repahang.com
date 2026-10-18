import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Assessor (RA) duties: accepted "Penilai Pengadil" appointments with the
/// status of their report, as features/penilai/assessments lists them.
/// Reports are written on the website.
class LaporanRaScreen extends StatelessWidget {
  const LaporanRaScreen({super.key});

  String get _webPath => Api.instance.user.value?.isDistrict == true ? '/pp-daerah/penilai' : '/penilai/penilaian';

  @override
  Widget build(BuildContext context) {
    return AsyncView<(List<Map<String, dynamic>>, List<Map<String, dynamic>>)>(
      loadingMessage: 'Memuatkan tugasan penilaian...',
      load: () async {
        final results = await Future.wait([
          Api.instance.get('/api/tugasan.php'),
          Api.instance.get('/api/laporan-penilaian.php', {'penilai': 1}),
        ]);
        List<Map<String, dynamic>> rows(Map<String, dynamic> body) =>
            (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        final duties = rows(results[0]).where((a) => a['status'] == 'Diterima' && a['jawatan'] == 'Penilai Pengadil').toList();
        return (duties, rows(results[1]));
      },
      builder: (context, data, reload) {
        final (duties, reports) = data;
        Map<String, dynamic>? reportFor(Map<String, dynamic> a) =>
            reports.where((r) => '${r['lantikan_id']}' == '${a['id']}').firstOrNull;
        final unfinished = duties.where((a) {
          final report = reportFor(a);
          return report == null || report['status'] == 'Draf';
        }).length;
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            WebCard(
              borderColor: unfinished > 0 ? Tw.amber200 : Tw.emerald200,
              child: Row(children: [
                Expanded(
                  child: Text(unfinished > 0 ? 'Laporan belum dihantar' : 'Semua laporan telah dihantar',
                      style: TextStyle(fontSize: 14, color: unfinished > 0 ? Tw.amber600 : Tw.emerald600)),
                ),
                Text('$unfinished',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: unfinished > 0 ? Tw.amber600 : Tw.emerald600)),
              ]),
            ),
            if (duties.isEmpty) const EmptyCard(icon: Icons.rate_review_outlined, message: 'Tiada tugasan penilaian.'),
            for (final a in duties) _card(context, a, reportFor(a)),
          ]),
        );
      },
    );
  }

  Widget _card(BuildContext context, Map<String, dynamic> a, Map<String, dynamic>? report) {
    final status = report == null ? 'Belum diisi' : text(report['status']);
    final tone = switch (status) {
      'Disahkan' => (Tw.green100, Tw.green700),
      'Dihantar' => (Tw.blue100, Tw.blue700),
      'Ditolak' => (Tw.red100, Tw.red700),
      'Draf' => (Tw.gray100, Tw.gray600),
      _ => (Tw.amber50, Tw.amber700),
    };
    final needsWork = report == null || report['status'] == 'Draf';
    return WebCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Text(text(a['nama_kejohanan']),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Tw.slate900)),
          ),
          StatusBadge(status, tone, pill: true),
        ]),
        const SizedBox(height: 6),
        Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Tw.slate800)),
        Text('${formatDate(a['tarikh'])}, ${formatTime(a['masa'])} · ${text(a['tempat'])}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        if (report != null && text(report['catatan_admin'], '').isNotEmpty)
          Text('Catatan Admin: ${report['catatan_admin']}', style: const TextStyle(fontSize: 12, color: Tw.red700)),
        if (needsWork) ...[
          const SizedBox(height: 12),
          YellowButton(
            label: report == null ? 'Isi laporan di website' : 'Sambung draf di website',
            icon: Icons.open_in_new,
            expand: true,
            onPressed: () => openWebsite(context, _webPath),
          ),
        ],
      ]),
    );
  }
}

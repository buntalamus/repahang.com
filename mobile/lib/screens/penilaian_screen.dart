import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// penilaian.component markahColor()/markahBg().
Tone markahTone(Object? raw) {
  final m = double.tryParse('${raw ?? ''}');
  if (m == null || m == 0) return (Tw.gray100, Tw.gray500);
  if (m >= 8.3) return (const Color(0xFFF0FDF4), Tw.green600);
  if (m >= 8.0) return (Tw.blue50, Tw.blue600);
  if (m >= 7.5) return (Tw.yellow50, Tw.yellow600);
  return (Tw.red50, Tw.red600);
}

/// The referee's confirmed assessment reports (/api/pengadil-penilaian.php),
/// following features/pengadil/penilaian.
class PenilaianScreen extends StatelessWidget {
  const PenilaianScreen({super.key});

  void _open(BuildContext context, Map<String, dynamic> report) {
    showWebModal<void>(
      context,
      title: 'Laporan Penilaian',
      body: (context) => AsyncView<Map<String, dynamic>>(
        load: () async => Map<String, dynamic>.from(
            (await Api.instance.get('/api/pengadil-penilaian.php', {'id': report['id']}))['data'] as Map),
        builder: (context, d, _) {
          final mine = Map<String, dynamic>.from(d['my_entry'] as Map? ?? {});
          Widget section(String title, String prefix) {
            final rows = [
              ('Kekuatan', mine['${prefix}_kekuatan']),
              ('Kelemahan', mine['${prefix}_kelemahan']),
              ('Nasihat', mine['${prefix}_nasihat']),
            ].where((r) => text(r.$2, '').isNotEmpty).toList();
            if (rows.isEmpty) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate800)),
                for (final (label, value) in rows) InfoRow(label, text(value)),
              ]),
            );
          }

          final tone = markahTone(mine['markah']);
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${text(d['pasukan_home'])} vs ${text(d['pasukan_away'])}',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate800)),
            Text('${text(d['nama_kejohanan'])} · ${formatDate(d['tarikh'])}',
                style: const TextStyle(fontSize: 12, color: Tw.slate500)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Text(text(mine['markah']), style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: tone.$2)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(mine['prestasi']), style: TextStyle(fontWeight: FontWeight.w600, color: tone.$2)),
                    Text('${text(mine['jawatan'])} · Kesukaran ${text(d['tahap_kesukaran'])}',
                        style: const TextStyle(fontSize: 12, color: Tw.slate600)),
                  ]),
                ),
              ]),
            ),
            InfoRow('Penilai', text(d['nama_penilai'])),
            section('Kawalan Perlawanan', 'kawalan'),
            section('Kecergasan Fizikal', 'fizikal'),
            section('Kerjasama', 'kerjasama'),
            if (text(d['ulasan_keseluruhan'], '').isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Ulasan Keseluruhan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate800)),
              Text(text(d['ulasan_keseluruhan']), style: const TextStyle(fontSize: 13, color: Tw.slate700)),
            ],
            const SizedBox(height: 16),
            OutlineButton(label: 'Muat turun PDF di website', icon: Icons.open_in_new,
                onPressed: () => openWebsite(context, '/pengadil/penilaian')),
          ]);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      loadingMessage: 'Memuatkan penilaian...',
      load: () async => ((await Api.instance.get('/api/pengadil-penilaian.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      builder: (context, reports, reload) {
        final marks = reports.map((r) => double.tryParse('${r['my_markah'] ?? ''}')).whereType<double>().toList();
        final average = marks.isEmpty ? 0 : marks.reduce((a, b) => a + b) / marks.length;
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              Expanded(
                child: WebCard(
                  margin: EdgeInsets.zero,
                  borderColor: Colors.transparent,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${reports.length}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                    const Text('Laporan disahkan', style: TextStyle(fontSize: 12, color: Tw.gray500)),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: WebCard(
                  margin: EdgeInsets.zero,
                  borderColor: Colors.transparent,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(average == 0 ? '-' : average.toStringAsFixed(1),
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: markahTone(average).$2)),
                    const Text('Purata markah', style: TextStyle(fontSize: 12, color: Tw.gray500)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 16),
            if (reports.isEmpty) const EmptyCard(icon: Icons.rate_review_outlined, message: 'Tiada laporan penilaian.'),
            for (final r in reports)
              WebCard(
                onTap: () => _open(context, r),
                child: Row(children: [
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: markahTone(r['my_markah']).$1, borderRadius: BorderRadius.circular(8)),
                    child: Text(text(r['my_markah']),
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: markahTone(r['my_markah']).$2)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${text(r['pasukan_home'])} vs ${text(r['pasukan_away'])}',
                          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14, color: Tw.slate800)),
                      Text('${text(r['nama_kejohanan'])} · ${formatDate(r['tarikh'])}',
                          style: const TextStyle(fontSize: 12, color: Tw.slate500)),
                      Text('${text(r['my_jawatan'])} · ${text(r['my_prestasi'])} · RA: ${text(r['nama_penilai'])}',
                          style: const TextStyle(fontSize: 12, color: Tw.slate500)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right, color: Tw.slate400),
                ]),
              ),
          ]),
        );
      },
    );
  }
}

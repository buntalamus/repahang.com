import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'rekod_screen.dart' show markahTone;

/// "3 - 1", with penalties in brackets, as the token form and PDF add it up:
/// first half + second half (`skor_ft`) + extra time. Null until both halves
/// are recorded.
String? finalScore(Map<String, dynamic> d) {
  int? goals(String period, String side) => int.tryParse('${d['skor_${period}_$side'] ?? ''}');
  String? side(String s) {
    final first = goals('ht', s), second = goals('ft', s);
    if (first == null || second == null) return null;
    final penalties = goals('ps', s);
    return '${first + second + (goals('et', s) ?? 0)}${penalties == null ? '' : ' ($penalties)'}';
  }
  final home = side('home'), away = side('away');
  return home == null || away == null ? null : '$home - $away';
}

/// Read-only RA report from /api/laporan-penilaian.php?id=, laid out like the
/// website's report modal.
class LaporanDetail extends StatelessWidget {
  const LaporanDetail({super.key, required this.report});
  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final d = report;
    final score = finalScore(d);
    final officials = (d['pegawai'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${text(d['pasukan_home'])} vs ${text(d['pasukan_away'])}',
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
      Text('${text(d['nama_kejohanan'])} · ${text(d['no_perlawanan'])} · ${formatDate(d['tarikh'])}',
          style: const TextStyle(color: AppColors.muted)),
      const SizedBox(height: 8),
      DetailRow(Icons.person_outline, 'Penilai', text(d['nama_penilai'])),
      DetailRow(Icons.place_outlined, 'Tempat', text(d['tempat'])),
      DetailRow(Icons.speed_rounded, 'Tahap kesukaran', text(d['tahap_kesukaran'])),
      if (text(d['cuaca'], '').isNotEmpty) DetailRow(Icons.wb_sunny_outlined, 'Cuaca', text(d['cuaca'])),
      if (score != null) DetailRow(Icons.scoreboard_outlined, 'Keputusan akhir', score),
      const SizedBox(height: 8),
      for (final o in officials) _Official(official: o),
      if (text(d['ulasan_keseluruhan'], '').isNotEmpty) ...[
        const SizedBox(height: 8),
        const Text('Ulasan keseluruhan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(text(d['ulasan_keseluruhan']), style: const TextStyle(fontSize: 14, height: 1.5)),
      ],
      if (text(d['catatan_admin'], '').isNotEmpty) ...[
        const SizedBox(height: 12),
        Text('Catatan Admin: ${d['catatan_admin']}', style: const TextStyle(fontSize: 13, color: Tw.rose700)),
      ],
    ]);
  }
}

class _Official extends StatelessWidget {
  const _Official({required this.official});
  final Map<String, dynamic> official;

  @override
  Widget build(BuildContext context) {
    final o = official;
    final jawatan = text(o['jawatan'], '');
    final tone = markahTone(o['markah']);
    // AR and 4th official criteria live in the kawalan_* columns.
    final sections = jawatan == 'Pengadil'
        ? [('Kawalan Permainan', 'kawalan'), ('Kecergasan Fizikal & Posisi', 'fizikal'), ('Kerjasama', 'kerjasama')]
        : [(jawatan.contains('Penolong') ? 'Penolong Pengadil' : 'Pegawai Keempat', 'kawalan')];
    List<String> items(Object? raw) => (raw is List ? raw : const []).map((e) => '$e').where((e) => e.isNotEmpty).toList();
    return AppCard(
      color: AppColors.background,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: tone.$1, shape: BoxShape.circle),
            child: Text(text(o['markah']), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: tone.$2)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(o['nama_pengadil']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              Text('${text(o['jawatan'])} · ${text(o['prestasi'])}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
            ]),
          ),
        ]),
        for (final (label, prefix) in sections)
          if (items(o['${prefix}_kekuatan']).isNotEmpty || items(o['${prefix}_kelemahan']).isNotEmpty ||
              text(o['${prefix}_nasihat'], '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            if (items(o['${prefix}_kekuatan']).isNotEmpty)
              DetailRow(Icons.thumb_up_alt_outlined, 'Kekuatan', items(o['${prefix}_kekuatan']).map((e) => '• $e').join('\n')),
            if (items(o['${prefix}_kelemahan']).isNotEmpty)
              DetailRow(Icons.trending_down_rounded, 'Kelemahan', items(o['${prefix}_kelemahan']).map((e) => '• $e').join('\n')),
            if (text(o['${prefix}_nasihat'], '').isNotEmpty)
              DetailRow(Icons.lightbulb_outline, 'Nasihat', text(o['${prefix}_nasihat'])),
          ],
      ]),
    );
  }
}

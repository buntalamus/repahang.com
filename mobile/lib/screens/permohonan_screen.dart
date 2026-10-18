import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _formLabels = {
  'pengadil_berdaftar': 'Pendaftaran Tahunan (R1)',
  'penilai_berdaftar': 'Penilai Pengadil Berdaftar',
  'pp_berdaftar': 'Pegawai Pembangunan Berdaftar',
  'pegawai_pembangunan': 'Pegawai Pembangunan',
  'ujian_kecergasan': 'Ujian Kecergasan',
  'kelas3_fam': 'Kelas III FAM',
  'ujian_kelas1_fam': 'Ujian Kelas I FAM',
  'lain_lain': 'Lain-lain',
};

String formLabel(Object? raw) {
  final key = '${raw ?? ''}';
  if (_formLabels.containsKey(key)) return _formLabels[key]!;
  final words = key.split('_').where((w) => w.isNotEmpty).map((w) => '${w[0].toUpperCase()}${w.substring(1)}');
  return words.isEmpty ? 'Permohonan' : words.join(' ');
}

/// Application history, following the "Sejarah Permohonan" table of
/// features/pengadil/application. New applications are made on the website.
class PermohonanScreen extends StatelessWidget {
  const PermohonanScreen({super.key});

  List<(String, IconData, String)> _forms() {
    final user = Api.instance.user.value;
    if (user?.isDistrict == true) {
      return [
        ('Pendaftaran Pengadil Saya', Icons.badge_outlined, '/pengadil/permohonan/berdaftar'),
        ('Kelas III FAM', Icons.quiz_outlined, '/pp-daerah/daftar/kelas3'),
        ('Kelas I FAM', Icons.military_tech_outlined, '/pp-daerah/daftar/kelas1'),
      ];
    }
    if (user?.role == 'Penilai') {
      return [('Pendaftaran Tahunan (R1)', Icons.how_to_reg_outlined, '/penilai/permohonan/tahunan')];
    }
    return [
      ('Pendaftaran Tahunan (R1)', Icons.badge_outlined, '/pengadil/permohonan/berdaftar'),
      ('Kelas III FAM', Icons.quiz_outlined, '/pengadil/permohonan/kelas3'),
      ('Ujian Kelas I FAM', Icons.military_tech_outlined, '/pengadil/permohonan/kelas1'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      loadingMessage: 'Memuatkan permohonan...',
      load: () async {
        final body = await Api.instance.get('/api/pengadil-application-history.php');
        return (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      },
      builder: (context, items, reload) => RefreshIndicator(
        color: Tw.pahangBlack,
        onRefresh: reload,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          WebCard(
            padding: EdgeInsets.zero,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: CardTitle('Permohonan Baharu', icon: Icons.description_outlined),
              ),
              for (final (label, icon, path) in _forms())
                InkWell(
                  onTap: () => openWebsite(context, path),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    decoration: const BoxDecoration(border: Border(top: BorderSide(color: Tw.slate100))),
                    child: Row(children: [
                      Icon(icon, size: 20, color: Tw.slate600),
                      const SizedBox(width: 12),
                      Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: Tw.slate700))),
                      const Icon(Icons.open_in_new, size: 16, color: Tw.slate400),
                    ]),
                  ),
                ),
            ]),
          ),
          WebCard(
            padding: EdgeInsets.zero,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Tw.slate100))),
                child: const CardTitle('Sejarah Permohonan', icon: Icons.history),
              ),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Column(children: [
                    Icon(Icons.description_outlined, size: 40, color: Tw.slate400),
                    SizedBox(height: 8),
                    Text('Tiada sejarah permohonan.', style: TextStyle(color: Tw.slate400, fontSize: 14)),
                  ]),
                ),
              for (var i = 0; i < items.length; i++) _row(i, items[i]),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _row(int index, Map<String, dynamic> a) {
    final status = text(a['status_workflow'] ?? a['status']);
    final notes = text(a['pp_notes'] ?? a['admin_notes'], '—');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(border: index == 0 ? null : const Border(top: BorderSide(color: Tw.slate100))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 24, child: Text('${index + 1}', style: const TextStyle(color: Tw.slate400, fontSize: 14))),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(formLabel(a['jenis_borang']),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Tw.slate800)),
            const SizedBox(height: 2),
            Text('${text(a['tarikh_hantar'])} · Sesi ${text(a['tahun_permohonan'], '—')}',
                style: const TextStyle(fontSize: 13, color: Tw.slate700)),
            if (notes != '—')
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(notes, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: Tw.slate500)),
              ),
          ]),
        ),
        const SizedBox(width: 8),
        StatusBadge(status, applicationTone(status), pill: true),
      ]),
    );
  }
}

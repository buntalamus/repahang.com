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

/// The user's applications and their status. New applications need uploads
/// and payment, so the form opens on the website.
class PermohonanScreen extends StatelessWidget {
  const PermohonanScreen({super.key});

  List<(String, String, IconData, String)> _forms() {
    final user = Api.instance.user.value;
    if (user?.isDistrict == true) {
      return [
        ('Pendaftaran Pengadil', 'Pendaftaran tahunan pengadil', Icons.badge_outlined, '/pengadil/permohonan/berdaftar'),
        ('Kelas III FAM', 'Kursus pengadil Kelas III', Icons.quiz_outlined, '/pp-daerah/daftar/kelas3'),
        ('Kelas I FAM', 'Ujian pengadil Kelas I', Icons.military_tech_outlined, '/pp-daerah/daftar/kelas1'),
      ];
    }
    if (user?.role == 'Penilai') {
      return [('Pendaftaran Tahunan (R1)', 'Pendaftaran penilai pengadil', Icons.how_to_reg_outlined, '/penilai/permohonan/tahunan')];
    }
    return [
      ('Pendaftaran Tahunan (R1)', 'Pendaftaran tahunan pengadil', Icons.badge_outlined, '/pengadil/permohonan/berdaftar'),
      ('Kelas III FAM', 'Kursus pengadil Kelas III', Icons.quiz_outlined, '/pengadil/permohonan/kelas3'),
      ('Ujian Kelas I FAM', 'Ujian pengadil Kelas I', Icons.military_tech_outlined, '/pengadil/permohonan/kelas1'),
    ];
  }

  void _newApplication(BuildContext context) {
    showAppSheet<void>(context, title: 'Permohonan baharu', builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Borang dan muat naik dokumen dibuat di website.', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 12),
        for (final (title, subtitle, icon, path) in _forms())
          AppCard(
            color: AppColors.background,
            onTap: () => openWebsite(context, path),
            child: Row(children: [
              CircleAvatar(backgroundColor: Tw.pahangYellow, foregroundColor: AppColors.black, child: Icon(icon)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  Text(subtitle, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                ]),
              ),
              const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.faint),
            ]),
          ),
      ],
    ));
  }

  void _details(BuildContext context, Map<String, dynamic> p) {
    final status = text(p['status_workflow'] ?? p['status']);
    showAppSheet<void>(context, builder: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Align(alignment: Alignment.centerLeft, child: Pill(status, applicationTone(status))),
      const SizedBox(height: 10),
      Text(formLabel(p['jenis_borang']), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      DetailRow(Icons.calendar_month_outlined, 'Sesi', text(p['tahun_permohonan'])),
      DetailRow(Icons.send_outlined, 'Tarikh hantar', text(p['tarikh_hantar'])),
      DetailRow(Icons.groups_outlined, 'Persatuan', text(p['district_name'])),
      if (text(p['status_ujian'], '').isNotEmpty) DetailRow(Icons.quiz_outlined, 'Status ujian', text(p['status_ujian'])),
      if (text(p['fitness_status'], '').isNotEmpty) DetailRow(Icons.directions_run, 'Ujian kecergasan', text(p['fitness_status'])),
      if (text(p['status_seminar'], '').isNotEmpty) DetailRow(Icons.school_outlined, 'Seminar', text(p['status_seminar'])),
      if (text(p['payment_amount'], '').isNotEmpty) DetailRow(Icons.payments_outlined, 'Bayaran', 'RM ${text(p['payment_amount'])}'),
      if (text(p['pp_notes'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan PP Daerah', text(p['pp_notes'])),
      if (text(p['admin_notes'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan Admin', text(p['admin_notes'])),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _newApplication(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Mohon'),
      ),
      body: AsyncView<List<Map<String, dynamic>>>(
        load: () async => ((await Api.instance.get('/api/pengadil-application-history.php'))['data'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
        builder: (context, items, reload) => RefreshList(onRefresh: reload, bottomPadding: 96, children: [
          if (items.isEmpty)
            const EmptyState(icon: Icons.description_outlined, title: 'Tiada permohonan',
                subtitle: 'Tekan "Mohon" untuk membuat permohonan baharu.'),
          for (final p in items)
            AppCard(
              onTap: () => _details(context, p),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.description_outlined),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(formLabel(p['jenis_borang']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text('Sesi ${text(p['tahun_permohonan'])} · ${text(p['tarikh_hantar'])}',
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                    const SizedBox(height: 6),
                    Pill(text(p['status_workflow'] ?? p['status']), applicationTone(text(p['status_workflow'] ?? p['status']))),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
              ]),
            ),
        ]),
      ),
    );
  }
}

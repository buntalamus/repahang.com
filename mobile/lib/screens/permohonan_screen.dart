import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_form_screen.dart';

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

/// The user's applications and their status, and the forms to apply.
class PermohonanScreen extends StatelessWidget {
  const PermohonanScreen({super.key});

  Future<void> _newApplication(BuildContext context, Future<void> Function() reload) async {
    final forms = appFormsFor(Api.instance.user.value!);
    final picked = await showAppSheet<AppForm>(context, title: 'Permohonan baharu', builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final f in forms)
          AppCard(
            color: AppColors.background,
            onTap: () => Navigator.pop(context, f),
            child: Row(children: [
              CircleAvatar(backgroundColor: Tw.pahangYellow, foregroundColor: AppColors.black, child: Icon(f.icon)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(f.label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  Text(f.subtitle, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
            ]),
          ),
      ],
    ));
    if (picked == null || !context.mounted) return;
    await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => PermohonanFormScreen(form: picked)));
    await reload();
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
      if (registrationPdfType(p) != null) ...[
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => downloadApplicationPdf(context, p),
          icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
          label: const Text('Muat turun borang (PDF)'),
        ),
      ],
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      load: () async => ((await Api.instance.get('/api/pengadil-application-history.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      builder: (context, items, reload) => Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton: appFormsFor(Api.instance.user.value!).isEmpty
            ? null
            : FloatingActionButton.extended(
                onPressed: () => _newApplication(context, reload),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Mohon'),
              ),
        body: RefreshList(onRefresh: reload, bottomPadding: 96, children: [
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

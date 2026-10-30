import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

/// admin-applications.php `type` → (label, download-referees-excel.php `type`).
const _types = {
  'berdaftar': ('Pengadil', 'pengadil_berdaftar'),
  'penilai': ('Penilai', 'penilai_berdaftar'),
  'kelas3': ('Kelas III', 'kelas3_fam'),
  'kelas1': ('Kelas I', 'ujian_kelas1_fam'),
};

/// Admin: applications of one or more forms for a year
/// (/api/admin-applications.php), with approve / reject / delete — the
/// website's /admin/permohonan-ra and /admin/laporan.
class AdminPermohonanScreen extends StatefulWidget {
  const AdminPermohonanScreen({super.key, required this.title, this.types = const ['berdaftar', 'penilai', 'kelas3', 'kelas1']});
  final String title;

  /// Keys of [_types] shown as tabs.
  final List<String> types;

  @override
  State<AdminPermohonanScreen> createState() => _AdminPermohonanScreenState();
}

class _AdminPermohonanScreenState extends State<AdminPermohonanScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  late String _type = widget.types.first;
  int _year = DateTime.now().year + 1;
  String _status = 'semua';
  String _query = '';

  static String _group(String status) => switch (status) {
        'Lengkap' || 'Admin Diluluskan' || 'Approved' => 'lulus',
        'Ditolak' || 'Rejected' => 'tolak',
        _ => 'tunggu',
      };

  Future<void> _open(Map<String, dynamic> a) async {
    final changed = await showAppSheet<bool>(context, builder: (_) => _ApplicationSheet(app: a));
    if (changed == true) await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final thisYear = DateTime.now().year;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: 'Eksport senarai berdaftar (CSV)',
            onPressed: () => downloadAndOpen(context, '/api/download-referees-excel.php',
                query: {'type': _types[_type]!.$2, 'year': _year.clamp(thisYear - 3, thisYear + 3)},
                fallbackName: 'senarai-$_year.csv'),
            icon: const Icon(Icons.file_download_outlined),
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Column(children: [
            if (widget.types.length > 1)
              FilterChips<String>(
                options: [for (final t in widget.types) (t, _types[t]!.$1)],
                value: _type,
                onChanged: (v) => setState(() => _type = v),
              ),
            FilterChips<int>(
              options: [for (var y = thisYear + 1; y >= thisYear - 2; y--) (y, 'Sesi $y')],
              value: _year,
              onChanged: (v) => setState(() => _year = v),
            ),
          ]),
        ),
        Expanded(
          child: AsyncView<Map<String, dynamic>>(
            key: ValueKey('$_type-$_year'),
            load: () => Api.instance.get('/api/admin-applications.php', {'type': _type, 'year': _year, 'status': 'all'}),
            builder: (context, body, reload) {
              final all = _rows(body['applications']);
              final q = _query.toLowerCase();
              final shown = all.where((a) {
                if (_status != 'semua' && _group(text(a['status'], '')) != _status) return false;
                return q.isEmpty ||
                    '${a['nama_penuh']} ${a['no_kp']} ${a['emel']} ${a['district_nama']}'.toLowerCase().contains(q);
              }).toList();
              int count(String g) => all.where((a) => _group(text(a['status'], '')) == g).length;
              return RefreshList(onRefresh: reload, children: [
                Row(children: [
                  Expanded(child: MiniStat(label: 'Jumlah', value: all.length)),
                  const SizedBox(width: 8),
                  Expanded(child: MiniStat(label: 'Menunggu', value: count('tunggu'), color: AppColors.black)),
                  const SizedBox(width: 8),
                  Expanded(child: MiniStat(label: 'Diluluskan', value: count('lulus'), color: Tw.emerald500)),
                  const SizedBox(width: 8),
                  Expanded(child: MiniStat(label: 'Ditolak', value: count('tolak'), color: Tw.rose300)),
                ]),
                const SizedBox(height: 12),
                TextField(
                  decoration: const InputDecoration(hintText: 'Cari nama, No. KP, emel atau daerah',
                      prefixIcon: Icon(Icons.search_rounded)),
                  onChanged: (v) => setState(() => _query = v.trim()),
                ),
                const SizedBox(height: 8),
                FilterChips<String>(
                  options: const [('semua', 'Semua'), ('tunggu', 'Menunggu'), ('lulus', 'Diluluskan'), ('tolak', 'Ditolak')],
                  value: _status,
                  onChanged: (v) => setState(() => _status = v),
                ),
                const SizedBox(height: 8),
                if (shown.isEmpty) const EmptyState(icon: Icons.description_outlined, title: 'Tiada permohonan'),
                for (final a in shown)
                  AppCard(
                    onTap: () => _open(a),
                    child: Row(children: [
                      Avatar(name: text(a['nama_penuh']), photo: a['url_gambar_profil'] as String?, radius: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(a['nama_penuh']), maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('${text(a['district_nama'])} · ${text(a['tarikh_hantar'])}', maxLines: 1,
                              overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                          const SizedBox(height: 6),
                          Pill(text(a['status']), applicationTone(text(a['status']))),
                        ]),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
                    ]),
                  ),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}

class _ApplicationSheet extends StatefulWidget {
  const _ApplicationSheet({required this.app});
  final Map<String, dynamic> app;

  @override
  State<_ApplicationSheet> createState() => _ApplicationSheetState();
}

class _ApplicationSheetState extends State<_ApplicationSheet> {
  final _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Map<String, dynamic> get a => widget.app;

  Future<void> _decide(bool approve) async {
    final notes = _notes.text.trim();
    if (!approve && notes.isEmpty) {
      showToast(context, 'Sila masukkan sebab penolakan.', ToastType.warning);
      return;
    }
    final ok = await confirmSheet(context, title: approve ? 'Luluskan permohonan?' : 'Tolak permohonan?',
        message: '${text(a['nama_penuh'])} · ${text(a['jenis_permohonan'])}. Pemohon akan dimaklumkan melalui emel.',
        confirmLabel: approve ? 'Luluskan' : 'Tolak',
        color: approve ? AppColors.black : Tw.rose600, textColor: approve ? Tw.pahangYellow : Colors.white);
    if (!ok) return;
    await _run(() => Api.instance.post('/api/admin-approve.php',
        {'permohonan_id': a['id'], 'action': approve ? 'approve' : 'reject', 'notes': notes}));
  }

  Future<void> _delete() async {
    final ok = await confirmSheet(context, title: 'Padam permohonan?',
        message: 'Adakah anda pasti mahu memadam permohonan ${text(a['nama_penuh'])}? Rekod perlawanan pengadil dikekalkan. '
            'Tindakan ini tidak boleh dibatalkan.',
        confirmLabel: 'Padam', color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    await _run(() => Api.instance.post('/api/admin-applications.php', {'action': 'delete_application', 'id': a['id']}));
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() => _busy = true);
    try {
      final result = await call();
      if (!mounted) return;
      showToast(context, text(result['message'], 'Berjaya.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = text(a['status']);
    final pending = status == 'Menunggu Admin';
    String join(List<Object?> parts) => parts.map((e) => text(e, '')).where((e) => e.isNotEmpty).join(', ');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Avatar(name: text(a['nama_penuh']), photo: a['url_gambar_profil'] as String?, radius: 26),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(a['nama_penuh']), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text(text(a['jenis_permohonan']), style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            const SizedBox(height: 4),
            Pill(status, applicationTone(status)),
          ]),
        ),
      ]),
      const SizedBox(height: 8),
      DetailRow(Icons.badge_outlined, 'No. KP', text(a['no_kp'])),
      DetailRow(Icons.phone_outlined, 'No. telefon', text(a['no_telefon']),
          onTap: () => callNumber(context, text(a['no_telefon'], ''))),
      DetailRow(Icons.mail_outline, 'Emel', text(a['emel'] ?? a['user_email'])),
      DetailRow(Icons.groups_outlined, 'Persatuan', text(a['district_nama'])),
      DetailRow(Icons.home_outlined, 'Alamat', text(join([a['alamat1'], a['alamat2'], a['poskod'], a['daerah'], a['negeri']]))),
      DetailRow(Icons.work_outline_rounded, 'Pekerjaan', text(join([a['status_kerja'], a['jawatan'], a['nama_majikan']]))),
      DetailRow(Icons.family_restroom_outlined, 'Waris', text(join([a['nama_waris'], a['hubungan_waris'], a['telefon_waris']]))),
      if (text(a['saiz_baju'], '').isNotEmpty) DetailRow(Icons.checkroom_outlined, 'Saiz baju', text(a['saiz_baju'])),
      if (a['total_matches'] != null)
        DetailRow(Icons.sports_outlined, 'Rekod perlawanan', '${text(a['total_matches'])} perlawanan disahkan'),
      if (text(a['penilai_jenis'], '').isNotEmpty)
        DetailRow(Icons.rate_review_outlined, 'Penilai',
            text(join([a['penilai_jenis'], '${text(a['penilai_tahun_pengalaman'], '')} tahun', a['penilai_kelayakan']]))),
      if (text(a['url_resit'], '').isNotEmpty)
        DetailRow(Icons.receipt_long_outlined, 'Resit bayaran', 'Lihat resit',
            onTap: () => downloadAndOpen(context, text(a['url_resit']), fallbackName: 'resit-${a['id']}'),
            trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.faint)),
      const SizedBox(height: 12),
      if (pending) ...[
        LabeledField(label: 'Nota / sebab penolakan', controller: _notes, maxLines: 3,
            hint: 'Pilihan untuk lulus, wajib untuk tolak'),
        Row(children: [
          Expanded(
            child: FilledButton(onPressed: _busy ? null : () => _decide(true), child: const Text('Luluskan')),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600),
              onPressed: _busy ? null : () => _decide(false),
              child: const Text('Tolak'),
            ),
          ),
        ]),
        const SizedBox(height: 8),
      ],
      TextButton.icon(
        style: TextButton.styleFrom(foregroundColor: Tw.rose600),
        onPressed: _busy ? null : _delete,
        icon: const Icon(Icons.delete_outline_rounded, size: 18),
        label: const Text('Padam permohonan'),
      ),
    ]);
  }
}

import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

/// Applications waiting for this role's decision.
/// PP Daerah: /api/pp-applications.php?type=pengesahan → /api/pp-verify.php.
/// Admin: /api/admin-applications.php?status=Menunggu Admin → /api/admin-approve.php.
class KelulusanView extends StatefulWidget {
  const KelulusanView({super.key, required this.admin});
  final bool admin;

  @override
  State<KelulusanView> createState() => _KelulusanViewState();
}

class _KelulusanViewState extends State<KelulusanView> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();

  Future<List<Map<String, dynamic>>> _load() async {
    final body = widget.admin
        ? await Api.instance.get('/api/admin-applications.php', {'status': 'Menunggu Admin', 'year': '${DateTime.now().year}'})
        : await Api.instance.get('/api/pp-applications.php', {'type': 'pengesahan'});
    final list = ((body['applications'] ?? body['data']) as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return widget.admin ? list.where((a) => text(a['status'], '') == 'Menunggu Admin').toList() : list;
  }

  Future<void> _decide(Map<String, dynamic> a, bool approve) async {
    final result = await showAppSheet<String>(
      context,
      title: approve ? (widget.admin ? 'Luluskan permohonan' : 'Sahkan permohonan') : 'Tolak permohonan',
      builder: (_) => _DecisionForm(application: a, approve: approve, admin: widget.admin),
    );
    if (result != null && mounted) {
      showToast(context, result);
      await _view.currentState?.reload();
    }
  }

  void _details(Map<String, dynamic> a) {
    final matches = (a['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    showAppSheet<void>(context, builder: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Avatar(name: text(a['nama_penuh'], ''), photo: a['url_gambar_profil'] as String?, radius: 32),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(a['nama_penuh']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang'])),
                style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          ]),
        ),
      ]),
      const SizedBox(height: 8),
      DetailRow(Icons.calendar_month_outlined, 'Sesi', text(a['tahun_permohonan'])),
      DetailRow(Icons.send_outlined, 'Tarikh hantar', text(a['tarikh_hantar'])),
      DetailRow(Icons.badge_outlined, 'No. KP', text(a['no_kp'] ?? a['no_ic'])),
      DetailRow(Icons.phone_outlined, 'Telefon', text(a['no_telefon']),
          onTap: text(a['no_telefon']) == '-' ? null : () => callNumber(context, text(a['no_telefon']))),
      DetailRow(Icons.groups_outlined, 'Persatuan', text(a['district_nama'] ?? a['district_name'])),
      DetailRow(Icons.sports_outlined, 'Jenis pengadil', text(a['jenis_pengadil'])),
      if (a['total_matches'] != null) DetailRow(Icons.sports_soccer, 'Perlawanan direkod', text(a['total_matches'])),
      if (text(a['pp_notes'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan PP', text(a['pp_notes'])),
      if (matches.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text('Rekod perlawanan (${matches.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        for (final p in matches.take(8))
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('${formatDate(p['tarikh'])} · ${text(p['jenis'])} · ${text(p['jawatan'])}',
                style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          ),
      ],
      const SizedBox(height: 16),
      OutlinedButton.icon(
        onPressed: () => openWebsite(context, widget.admin ? '/admin/permohonan' : '/pp-daerah/pengesahan'),
        icon: const Icon(Icons.open_in_new_rounded, size: 18),
        label: const Text('Dokumen penuh di website'),
      ),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      key: _view,
      load: _load,
      builder: (context, items, reload) => RefreshList(onRefresh: reload, children: [
        if (items.isEmpty)
          const EmptyState(icon: Icons.task_alt_rounded, title: 'Tiada permohonan menunggu',
              subtitle: 'Semua permohonan telah diproses.'),
        for (final a in items)
          AppCard(
            onTap: () => _details(a),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Avatar(name: text(a['nama_penuh'], ''), photo: a['url_gambar_profil'] as String?, radius: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(a['nama_penuh']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text('${text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang']))} · ${text(a['tahun_permohonan'])}',
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                    Text(text(a['district_nama'] ?? a['district_name']),
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                  ]),
                ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _decide(a, false),
                    style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600, side: const BorderSide(color: Tw.rose300),
                        minimumSize: const Size(0, 44)),
                    child: const Text('Tolak'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _decide(a, true),
                    style: FilledButton.styleFrom(backgroundColor: Tw.emerald600, foregroundColor: Colors.white,
                        minimumSize: const Size(0, 44)),
                    child: Text(widget.admin ? 'Luluskan' : 'Sahkan'),
                  ),
                ),
              ]),
            ]),
          ),
      ]),
    );
  }
}

class _DecisionForm extends StatefulWidget {
  const _DecisionForm({required this.application, required this.approve, required this.admin});
  final Map<String, dynamic> application;
  final bool approve;
  final bool admin;

  @override
  State<_DecisionForm> createState() => _DecisionFormState();
}

class _DecisionFormState extends State<_DecisionForm> {
  final _notes = TextEditingController();
  bool _saving = false;

  // The website asks PP Daerah for a note only when rejecting.
  bool get _withNotes => !widget.approve || widget.admin;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!widget.approve && _notes.text.trim().isEmpty) {
      showToast(context, 'Sebab penolakan diperlukan.', ToastType.error);
      return;
    }
    setState(() => _saving = true);
    final a = widget.application;
    try {
      final result = await Api.instance.post(widget.admin ? '/api/admin-approve.php' : '/api/pp-verify.php', {
        'permohonan_id': a['permohonan_id'] ?? a['id'],
        'action': widget.approve ? 'approve' : 'reject',
        if (_withNotes) 'notes': _notes.text.trim(),
      });
      if (mounted) {
        Navigator.pop(context, text(result['message'],
            widget.approve ? (widget.admin ? 'Permohonan diluluskan.' : 'Permohonan disahkan.') : 'Permohonan ditolak.'));
      }
    } on ApiException catch (error) {
      if (mounted) {
        showToast(context, error.message, ToastType.error);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.application;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${text(a['nama_penuh'])}\n${text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang']))} · Sesi ${text(a['tahun_permohonan'])}',
          style: const TextStyle(fontSize: 15, color: Tw.slate600, height: 1.5)),
      const SizedBox(height: 16),
      if (_withNotes)
        LabeledField(label: widget.approve ? 'Catatan (pilihan)' : 'Sebab penolakan', required: !widget.approve,
            controller: _notes, maxLines: 3),
      FilledButton(
        onPressed: _saving ? null : _submit,
        style: FilledButton.styleFrom(
            backgroundColor: widget.approve ? Tw.emerald600 : Tw.rose600, foregroundColor: Colors.white),
        child: _saving
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(widget.approve ? (widget.admin ? 'Sahkan lulus' : 'Sahkan') : 'Sahkan tolak'),
      ),
      TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: const Text('Batal')),
    ]);
  }
}

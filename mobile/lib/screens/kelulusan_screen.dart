import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

/// Applications waiting for this role's decision.
/// PP Daerah: /api/pp-applications.php?type=pengesahan → /api/pp-verify.php.
/// Admin: /api/admin-applications.php?status=Menunggu Admin → /api/admin-approve.php.
/// Both post {permohonan_id, action: approve|reject, notes} like the website.
class KelulusanScreen extends StatefulWidget {
  const KelulusanScreen({super.key, required this.admin});
  final bool admin;

  @override
  State<KelulusanScreen> createState() => _KelulusanScreenState();
}

class _KelulusanScreenState extends State<KelulusanScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();

  Future<List<Map<String, dynamic>>> _load() async {
    final body = widget.admin
        ? await Api.instance.get('/api/admin-applications.php',
            {'status': 'Menunggu Admin', 'year': '${DateTime.now().year}'})
        : await Api.instance.get('/api/pp-applications.php', {'type': 'pengesahan'});
    final rows = (body['applications'] ?? body['data']) as List? ?? [];
    final list = rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    // The admin list for the year may include other statuses; keep the decisions due.
    return widget.admin ? list.where((a) => text(a['status'], '') == 'Menunggu Admin').toList() : list;
  }

  Future<void> _decide(Map<String, dynamic> a, bool approve) async {
    final result = await showWebModal<String>(
      context,
      title: approve ? (widget.admin ? 'Luluskan Permohonan' : 'Sahkan Permohonan') : 'Tolak Permohonan',
      body: (_) => _DecisionForm(application: a, approve: approve, admin: widget.admin),
    );
    if (result != null && mounted) {
      showToast(context, result);
      await _view.currentState?.reload();
    }
  }

  void _details(Map<String, dynamic> a) {
    final matches = (a['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final photo = text(a['url_gambar_profil'], '');
    showWebModal<void>(
      context,
      title: text(a['nama_penuh']),
      body: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (photo.isNotEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(Api.instance.absoluteUrl(photo), headers: Api.instance.imageHeaders,
                    width: 96, height: 96, fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
            ),
          ),
        InfoRow('Jenis', text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang']))),
        InfoRow('Sesi', text(a['tahun_permohonan'])),
        InfoRow('Tarikh hantar', text(a['tarikh_hantar'])),
        InfoRow('No. KP', text(a['no_kp'] ?? a['no_ic'])),
        InfoRow('Telefon', text(a['no_telefon'])),
        InfoRow('Persatuan', text(a['district_nama'] ?? a['district_name'])),
        InfoRow('Jenis pengadil', text(a['jenis_pengadil'])),
        if (a['total_matches'] != null) InfoRow('Perlawanan', text(a['total_matches'])),
        if (text(a['pp_notes'], '').isNotEmpty) InfoRow('Catatan PP', text(a['pp_notes'])),
        if (matches.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Rekod perlawanan (${matches.length})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
          for (final p in matches.take(10))
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('${text(p['tarikh'])} · ${text(p['jenis'])} · ${text(p['jawatan'])} · ${text(p['tempat'])}',
                  style: const TextStyle(fontSize: 12, color: Tw.slate500)),
            ),
        ],
        const SizedBox(height: 16),
        OutlineButton(
          label: 'Dokumen penuh di website',
          icon: Icons.open_in_new,
          onPressed: () => openWebsite(context, widget.admin ? '/admin/permohonan' : '/pp-daerah/pengesahan'),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      key: _view,
      loadingMessage: 'Memuatkan permohonan...',
      load: _load,
      builder: (context, items, reload) => RefreshIndicator(
        color: Tw.pahangBlack,
        onRefresh: reload,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          WebCard(
            borderColor: Tw.amber200,
            child: Row(children: [
              Expanded(
                child: Text(widget.admin ? 'Menunggu kelulusan Admin' : 'Menunggu pengesahan PP Daerah',
                    style: const TextStyle(fontSize: 14, color: Tw.amber600)),
              ),
              Text('${items.length}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Tw.amber600)),
            ]),
          ),
          if (items.isEmpty) const EmptyCard(icon: Icons.task_alt, message: 'Tiada permohonan menunggu tindakan.'),
          for (final a in items) _card(a),
        ]),
      ),
    );
  }

  Widget _card(Map<String, dynamic> a) {
    final status = text(a['status_workflow'] ?? a['status']);
    return WebCard(
      onTap: () => _details(a),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(a['nama_penuh']), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Tw.slate900)),
              Text(text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang'])),
                  style: const TextStyle(fontSize: 12, color: Tw.slate500)),
            ]),
          ),
          StatusBadge(status, applicationTone(status), pill: true),
        ]),
        const SizedBox(height: 6),
        Text('Sesi ${text(a['tahun_permohonan'])} · ${text(a['tarikh_hantar'])}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        if (text(a['district_nama'] ?? a['district_name'], '').isNotEmpty)
          Text(text(a['district_nama'] ?? a['district_name']), style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.only(top: 8),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Tw.slate100))),
          child: Row(children: [
            Expanded(
              child: SolidButton(
                label: widget.admin ? 'Luluskan' : 'Sahkan',
                color: Tw.emerald600,
                expand: true,
                onPressed: () => _decide(a, true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlineButton(
                  label: 'Tolak', border: Tw.rose300, fg: Tw.rose600, expand: true, onPressed: () => _decide(a, false)),
            ),
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
        if (!widget.approve || widget.admin) 'notes': _notes.text.trim(),
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
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Tw.slate50, borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(text(a['nama_penuh']), style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate800)),
          Text('${text(a['jenis_permohonan'] ?? formLabel(a['jenis_borang']))} · Sesi ${text(a['tahun_permohonan'])}',
              style: const TextStyle(fontSize: 13, color: Tw.slate600)),
        ]),
      ),
      const SizedBox(height: 16),
      // The website asks PP Daerah for a note only when rejecting.
      if (!widget.approve || widget.admin) ...[
        FieldLabel(widget.approve ? 'Catatan (pilihan)' : 'Sebab Penolakan', required: !widget.approve, small: true),
        TextField(controller: _notes, maxLines: 3, style: const TextStyle(fontSize: 14)),
        const SizedBox(height: 16),
      ],
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        OutlineButton(label: 'Batal', onPressed: _saving ? null : () => Navigator.pop(context)),
        const SizedBox(width: 12),
        Flexible(
          child: SolidButton(
            label: _saving ? 'Menyimpan...' : (widget.approve ? (widget.admin ? 'Sahkan Lulus' : 'Sahkan') : 'Sahkan Tolak'),
            color: widget.approve ? Tw.emerald600 : Tw.rose500,
            busy: _saving,
            onPressed: _submit,
          ),
        ),
      ]),
    ]);
  }
}

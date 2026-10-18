import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// PP Daerah verification of officials' self-reported matches, following
/// features/pp-daerah/match-verification and /api/pp-verify-match.php.
class PengesahanScreen extends StatefulWidget {
  const PengesahanScreen({super.key});

  @override
  State<PengesahanScreen> createState() => _PengesahanScreenState();
}

/// match-verification getStatusClass().
Tone _verifyTone(String status) => switch (status) {
      'Disahkan' => (Tw.green100, const Color(0xFF166534)),
      '' || 'Belum Disahkan' || 'Menunggu' => (const Color(0xFFFEF3C7), Tw.amber800),
      _ => (Tw.red100, const Color(0xFF991B1B)),
    };

class _PengesahanScreenState extends State<PengesahanScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _filter = 'pending';

  Future<Map<String, dynamic>> _load() =>
      Api.instance.get('/api/pp-verify-match.php', {'status': _filter, 'page': 1, 'per_page': 50});

  void _setFilter(String value) {
    setState(() => _filter = value);
    _view.currentState?.reload();
  }

  Future<void> _open(Map<String, dynamic> m) async {
    final result = await showWebModal<String>(context, title: 'Pengesahan Perlawanan', body: (_) => _VerifyForm(match: m));
    if (result != null && mounted) {
      showToast(context, result);
      await _view.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      loadingMessage: 'Memuatkan rekod perlawanan...',
      load: _load,
      builder: (context, body, reload) {
        final stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
        final matches = (body['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              _stat('Menunggu', stats['pending'], 'pending', Tw.amber200, Tw.amber600),
              const SizedBox(width: 12),
              _stat('Disahkan', stats['verified'], 'verified', Tw.emerald200, Tw.emerald600),
              const SizedBox(width: 12),
              _stat('Ditolak', stats['rejected'], 'rejected', Tw.red200, Tw.red600),
            ]),
            const SizedBox(height: 16),
            if (matches.isEmpty) const EmptyCard(icon: Icons.fact_check_outlined, message: 'Tiada rekod perlawanan.'),
            for (final m in matches) _card(m),
          ]),
        );
      },
    );
  }

  Widget _stat(String label, Object? value, String filter, Color border, Color fg) {
    final selected = _filter == filter;
    return Expanded(
      child: WebCard(
        margin: EdgeInsets.zero,
        borderColor: selected ? fg : Tw.slate200,
        onTap: () => _setFilter(filter),
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 12, color: fg)),
          Text('${value ?? 0}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: fg)),
        ]),
      ),
    );
  }

  Widget _card(Map<String, dynamic> m) {
    final status = text(m['status_pp'], '');
    final label = status.isEmpty || status == 'Belum Disahkan' ? 'Menunggu' : status;
    final officials = (m['officials'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final conflicts = (m['pertindihan'] as List? ?? []).isNotEmpty;
    return WebCard(
      onTap: () => _open(m),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Tw.slate900)),
          ),
          StatusBadge(label, _verifyTone(status), pill: true),
        ]),
        const SizedBox(height: 4),
        Text('${formatDate(m['tarikh'])}${text(m['masa'], '').isEmpty ? '' : ' · ${formatTime(m['masa'])}'} · ${text(m['jenis'])}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        Text('${text(m['tempat'])}${text(m['daerah_perlawanan_nama'], '').isEmpty ? '' : ' · ${m['daerah_perlawanan_nama']}'}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        if (officials.isNotEmpty) ...[
          const SizedBox(height: 6),
          for (final o in officials)
            Text('${text(o['jawatan'])}: ${text(o['nama'])}', style: const TextStyle(fontSize: 12, color: Tw.slate600)),
        ],
        Text('Dihantar oleh ${text(m['submitter_name'])}', style: const TextStyle(fontSize: 11, color: Tw.slate400)),
        if (conflicts)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: StatusBadge('Perlu semakan: pertindihan', (Tw.orange50, Tw.orange700), small: true),
          ),
      ]),
    );
  }
}

class _VerifyForm extends StatefulWidget {
  const _VerifyForm({required this.match});
  final Map<String, dynamic> match;

  @override
  State<_VerifyForm> createState() => _VerifyFormState();
}

class _VerifyFormState extends State<_VerifyForm> {
  final _notes = TextEditingController();
  bool _reviewed = false;
  bool _busy = false;
  late List<Map<String, dynamic>> _conflicts =
      (widget.match['pertindihan'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  Map<String, dynamic> get m => widget.match;
  bool get _pending => text(m['status_pp'], '').isEmpty || m['status_pp'] == 'Belum Disahkan';

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit(String action) async {
    if (action == 'verify' && _conflicts.isNotEmpty && (!_reviewed || _notes.text.trim().isEmpty)) {
      showToast(context, 'Tandakan semakan pertindihan dan isi catatan sebelum mengesahkan.', ToastType.error);
      return;
    }
    setState(() => _busy = true);
    final payload = <String, dynamic>{'action': action, 'notes': _notes.text};
    if (action == 'verify' && _conflicts.isNotEmpty) payload['sahkan_pertindihan'] = _reviewed;
    if (m['is_grouped'] == true && m['match_group_id'] != null) {
      payload['match_group_id'] = m['match_group_id'];
    } else {
      payload['match_id'] = m['id'];
    }
    try {
      final result = await Api.instance.post('/api/pp-verify-match.php', payload);
      if (mounted) Navigator.pop(context, text(result['message'], 'Rekod dikemaskini.'));
    } on ApiException catch (error) {
      if (!mounted) return;
      showToast(context, error.message, ToastType.error);
      setState(() => _busy = false);
      // The server may have found new overlapping records; reload them for review.
      try {
        final fresh = await Api.instance.get('/api/pp-verify-match.php', {'status': 'pending', 'page': 1, 'per_page': 50});
        final same = (fresh['matches'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .where((x) => x['id'] == m['id'])
            .toList();
        if (same.isNotEmpty && mounted) {
          setState(() {
            _conflicts = (same.first['pertindihan'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
            _reviewed = false;
          });
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final officials = (m['officials'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final duplicate = _conflicts.any((c) => c['jenis'] == 'berganda');
    String score(String k) => m['skor_${k}_home'] == null ? '' : '${m['skor_${k}_home']}-${m['skor_${k}_away']}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Tw.slate50, borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
              style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate800)),
          Text('${formatDate(m['tarikh'])} ${text(m['masa'], '')} · ${text(m['jenis'])}',
              style: const TextStyle(fontSize: 13, color: Tw.slate600)),
          Text(text(m['tempat']), style: const TextStyle(fontSize: 13, color: Tw.slate600)),
          if (text(m['nama_kejohanan'], '').isNotEmpty)
            Text(text(m['nama_kejohanan']), style: const TextStyle(fontSize: 13, color: Tw.slate600)),
          if (score('ft').isNotEmpty)
            Text('FT ${score('ft')}${score('ht').isEmpty ? '' : ' · HT ${score('ht')}'}',
                style: const TextStyle(fontSize: 13, color: Tw.slate700, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          for (final o in officials)
            Text('${text(o['jawatan'])}: ${text(o['nama'])}', style: const TextStyle(fontSize: 12, color: Tw.slate600)),
        ]),
      ),
      if (_conflicts.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Tw.orange50,
            border: Border.all(color: Tw.orange200),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(duplicate ? 'Kemungkinan rekod berganda' : 'Pegawai bertembung',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.orange700, fontSize: 13)),
            for (final c in _conflicts)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${text(c['home_team'])} vs ${text(c['away_team'])} · ${c['jenis'] == 'berganda' ? 'Berganda' : 'Bertembung'}\n'
                  '${formatDate(c['tarikh'])}${text(c['masa'], '').isEmpty ? '' : ' · ${c['masa']}'} · ${text(c['tempat'])}\n'
                  '${text(c['sumber'])} · ${text(c['status_pp'])}\n'
                  'Pegawai: ${(c['pegawai'] as List? ?? []).join(', ')}',
                  style: const TextStyle(fontSize: 12, color: Tw.slate700),
                ),
              ),
            GestureDetector(
              onTap: () => setState(() => _reviewed = !_reviewed),
              child: Row(children: [
                Checkbox(
                  value: _reviewed,
                  activeColor: Tw.pahangBlack,
                  onChanged: (value) => setState(() => _reviewed = value ?? false),
                ),
                const Expanded(child: Text('Saya telah menyemak pertindihan ini', style: TextStyle(fontSize: 13))),
              ]),
            ),
          ]),
        ),
      ],
      const SizedBox(height: 12),
      FieldLabel(_conflicts.isEmpty ? 'Catatan (pilihan)' : 'Catatan', required: _conflicts.isNotEmpty, small: true),
      TextField(controller: _notes, maxLines: 2, style: const TextStyle(fontSize: 14)),
      const SizedBox(height: 16),
      if (_pending)
        Row(children: [
          Expanded(
            child: OutlineButton(label: 'Tolak', border: Tw.rose300, fg: Tw.rose600, expand: true,
                onPressed: _busy ? null : () => _submit('reject')),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SolidButton(label: 'Sahkan', color: Tw.emerald600, expand: true, busy: _busy,
                onPressed: () => _submit('verify')),
          ),
        ])
      else
        OutlineButton(label: 'Kembalikan ke Menunggu', expand: true, onPressed: _busy ? null : () => _submit('revert')),
    ]);
  }
}

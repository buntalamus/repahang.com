import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'kelulusan_screen.dart';

/// PP Daerah reviews: officials' match records and applications.
class SemakanScreen extends StatefulWidget {
  const SemakanScreen({super.key});

  @override
  State<SemakanScreen> createState() => _SemakanScreenState();
}

class _SemakanScreenState extends State<SemakanScreen> {
  String _segment = 'perlawanan';

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        child: SizedBox(
          width: double.infinity,
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 'perlawanan', label: Text('Perlawanan'), icon: Icon(Icons.sports_soccer, size: 18)),
              ButtonSegment(value: 'permohonan', label: Text('Permohonan'), icon: Icon(Icons.description_outlined, size: 18)),
            ],
            selected: {_segment},
            onSelectionChanged: (value) => setState(() => _segment = value.first),
          ),
        ),
      ),
      Expanded(
        child: IndexedStack(index: _segment == 'perlawanan' ? 0 : 1, children: const [
          PengesahanView(),
          KelulusanView(admin: false),
        ]),
      ),
    ]);
  }
}

Tone _verifyTone(String status) => switch (status) {
      'Disahkan' => (Tw.green100, Tw.green700),
      '' || 'Belum Disahkan' => (Tw.amber50, Tw.amber700),
      _ => (Tw.red100, Tw.red700),
    };

/// Verification of officials' self-reported matches (/api/pp-verify-match.php).
class PengesahanView extends StatefulWidget {
  const PengesahanView({super.key});

  @override
  State<PengesahanView> createState() => _PengesahanViewState();
}

class _PengesahanViewState extends State<PengesahanView> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _filter = 'pending';

  Future<void> _open(Map<String, dynamic> m) async {
    final result = await showAppSheet<String>(context, builder: (_) => _VerifyForm(match: m));
    if (result != null && mounted) {
      showToast(context, result);
      await _view.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      load: () => Api.instance.get('/api/pp-verify-match.php', {'status': _filter, 'page': 1, 'per_page': 50}),
      builder: (context, body, reload) {
        final stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
        final matches = (body['matches'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        return RefreshList(onRefresh: reload, children: [
          FilterChips<String>(
            options: [
              ('pending', 'Menunggu (${stats['pending'] ?? 0})'),
              ('verified', 'Disahkan (${stats['verified'] ?? 0})'),
              ('rejected', 'Ditolak (${stats['rejected'] ?? 0})'),
            ],
            value: _filter,
            onChanged: (v) {
              setState(() => _filter = v);
              _view.currentState?.reload();
            },
          ),
          const SizedBox(height: 8),
          if (matches.isEmpty)
            EmptyState(icon: Icons.fact_check_outlined,
                title: _filter == 'pending' ? 'Tiada rekod menunggu pengesahan' : 'Tiada rekod'),
          for (final m in matches) _card(m),
        ]);
      },
    );
  }

  Widget _card(Map<String, dynamic> m) {
    final status = text(m['status_pp'], '');
    final officials = (m['officials'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final conflicts = (m['pertindihan'] as List? ?? []).isNotEmpty;
    final pending = status.isEmpty || status == 'Belum Disahkan';
    return AppCard(
      accent: pending ? (conflicts ? Tw.orange600 : Tw.pahangYellow) : null,
      onTap: () => _open(m),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DateBlock(m['tarikh'], highlight: pending),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Dihantar oleh ${text(m['submitter_name'])}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
            Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            Text('${text(m['jenis'])} · ${text(m['tempat'])}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            Text('${officials.length} pegawai', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            if (conflicts)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Pill('Pertindihan perlu disemak', (Tw.orange50, Tw.orange700), icon: Icons.warning_amber_rounded),
              ),
          ]),
        ),
        Pill(pending ? 'Menunggu' : status, _verifyTone(status)),
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
    String score(String k) => m['skor_${k}_home'] == null ? '' : '${m['skor_${k}_home']} - ${m['skor_${k}_away']}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${text(m['home_team'])} vs ${text(m['away_team'])}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      if (score('ft').isNotEmpty)
        Text('Keputusan ${score('ft')}${score('ht').isEmpty ? '' : '  (HT ${score('ht')})'}',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      DetailRow(Icons.event_outlined, 'Tarikh', '${formatDayDate(m['tarikh'])}${text(m['masa'], '').isEmpty ? '' : ', ${formatTime(m['masa'])}'}'),
      DetailRow(Icons.place_outlined, 'Tempat', '${text(m['tempat'])}${text(m['daerah_perlawanan_nama'], '').isEmpty ? '' : ' · ${m['daerah_perlawanan_nama']}'}'),
      DetailRow(Icons.category_outlined, 'Jenis', '${text(m['jenis'])}${text(m['nama_kejohanan'], '').isEmpty ? '' : ' · ${m['nama_kejohanan']}'}'),
      DetailRow(Icons.person_outline, 'Dihantar oleh', text(m['submitter_name'])),
      const SizedBox(height: 8),
      const Text('Pegawai', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      for (final o in officials)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text('${text(o['jawatan'])}: ${text(o['nama'])}', style: const TextStyle(fontSize: 14)),
        ),
      if (_conflicts.isNotEmpty) ...[
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Tw.orange50, borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.warning_amber_rounded, color: Tw.orange700),
              const SizedBox(width: 8),
              Text(duplicate ? 'Kemungkinan rekod berganda' : 'Pegawai bertembung',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: Tw.orange700)),
            ]),
            for (final c in _conflicts)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '${text(c['home_team'])} vs ${text(c['away_team'])} · ${c['jenis'] == 'berganda' ? 'Berganda' : 'Bertembung'}\n'
                  '${formatDate(c['tarikh'])}${text(c['masa'], '').isEmpty ? '' : ' · ${c['masa']}'} · ${text(c['tempat'])}\n'
                  '${text(c['sumber'])} · ${text(c['status_pp'])} · Pegawai: ${(c['pegawai'] as List? ?? []).join(', ')}',
                  style: const TextStyle(fontSize: 13, color: Tw.slate700, height: 1.4),
                ),
              ),
            const SizedBox(height: 4),
            Row(children: [
              Checkbox(value: _reviewed, onChanged: (v) => setState(() => _reviewed = v ?? false)),
              const Expanded(child: Text('Saya telah menyemak pertindihan ini', style: TextStyle(fontSize: 14))),
            ]),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      LabeledField(label: 'Catatan', required: _conflicts.isNotEmpty, controller: _notes, maxLines: 2,
          hint: _conflicts.isEmpty ? 'Pilihan' : null),
      if (_pending)
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _busy ? null : () => _submit('reject'),
              style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600, side: const BorderSide(color: Tw.rose300)),
              child: const Text('Tolak'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: _busy ? null : () => _submit('verify'),
              style: FilledButton.styleFrom(backgroundColor: Tw.emerald600, foregroundColor: Colors.white),
              child: const Text('Sahkan'),
            ),
          ),
        ])
      else
        OutlinedButton(onPressed: _busy ? null : () => _submit('revert'), child: const Text('Kembalikan ke Menunggu')),
    ]);
  }
}

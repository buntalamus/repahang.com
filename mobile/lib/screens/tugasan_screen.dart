import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// The official's appointments, following features/pengadil/tugasan (mobile cards).
class TugasanScreen extends StatefulWidget {
  const TugasanScreen({super.key});

  @override
  State<TugasanScreen> createState() => _TugasanScreenState();
}

const _filters = [
  ('all', 'Semua'),
  ('Belum Jawab', 'Belum Jawab'),
  ('Diterima', 'Diterima'),
  ('Ditolak', 'Ditolak'),
  ('Dibatalkan', 'Dibatalkan'),
  ('Ditangguhkan', 'Ditangguhkan'),
];

/// shared/appointment-deadline.ts: late replacements may answer until kickoff.
DateTime? responseDeadline(String kind, DateTime? kickoff, DateTime? notified) {
  if (kickoff == null || notified == null || !notified.isBefore(kickoff)) return null;
  final hours = kind.trim().toLowerCase() == 'liga' ? 48 : 3;
  final cutoff = kickoff.subtract(Duration(hours: hours));
  return notified.isBefore(cutoff) ? cutoff : kickoff;
}

DateTime? _klInstant(String raw) {
  final value = raw.trim().replaceFirst(' ', 'T');
  if (value.isEmpty) return null;
  return DateTime.tryParse('$value+08:00');
}

class _TugasanScreenState extends State<TugasanScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _filter = 'all';

  String _deadlineText(Map<String, dynamic> a) {
    final notified = _klInstant(text(a['tarikh_notif'], ''));
    final kickoff = _klInstant('${'${a['tarikh']}'.padRight(10).substring(0, 10)}T${text(a['masa'], '00:00:00')}');
    final at = responseDeadline(text(a['jenis_kejohanan'], ''), kickoff, notified);
    return at == null ? '' : formatKl(at);
  }

  String _autoRejectRule(Object? jenis) {
    final hours = '${jenis ?? ''}' == 'Liga' ? 48 : 3;
    return 'Jawab selewat-lewatnya $hours jam sebelum perlawanan bermula. '
        'Lantikan lewat/pengganti boleh dijawab sehingga perlawanan bermula.';
  }

  Future<void> _openAction(Map<String, dynamic> a, String action) async {
    final result = await showWebModal<String>(
      context,
      title: action == 'accept' ? 'Terima Tugasan' : 'Tolak Tugasan',
      body: (_) => _ActionForm(appointment: a, action: action),
    );
    if (result != null && mounted) {
      showToast(context, result);
      await _view.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      loadingMessage: 'Memuatkan tugasan...',
      load: () => Api.instance.get('/api/tugasan.php'),
      builder: (context, body, reload) {
        final all = (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        final stats = Map<String, dynamic>.from(body['stats'] as Map? ?? {});
        final items = _filter == 'all' ? all : all.where((a) => a['status'] == _filter).toList();
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            _statsGrid(stats),
            const SizedBox(height: 24),
            WebCard(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 24),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (final (value, label) in _filters)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _FilterButton(
                          label: label, selected: _filter == value, onTap: () => setState(() => _filter = value)),
                    ),
                ]),
              ),
            ),
            if (items.isEmpty) const EmptyCard(icon: Icons.assignment_outlined, message: 'Tiada tugasan.'),
            for (final a in items) _card(a),
          ]),
        );
      },
    );
  }

  Widget _statsGrid(Map<String, dynamic> stats) {
    Widget stat(String label, String key, Color border, Color fg, {String? filter}) => Expanded(
          child: WebCard(
            margin: EdgeInsets.zero,
            borderColor: border,
            onTap: filter == null ? null : () => setState(() => _filter = filter),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: TextStyle(fontSize: 14, color: fg == Tw.slate900 ? Tw.gray500 : fg)),
              const SizedBox(height: 4),
              Text('${stats[key] ?? 0}', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: fg)),
            ]),
          ),
        );
    return Column(children: [
      Row(children: [
        stat('Jumlah', 'total', Tw.gray200, Tw.slate900, filter: 'all'),
        const SizedBox(width: 16),
        stat('Belum Jawab', 'belum_jawab', Tw.amber200, Tw.amber600, filter: 'Belum Jawab'),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        stat('Diterima', 'diterima', Tw.emerald200, Tw.emerald600, filter: 'Diterima'),
        const SizedBox(width: 16),
        stat('Ditolak', 'ditolak', Tw.rose200, Tw.rose600, filter: 'Ditolak'),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        stat('Dibatalkan', 'dibatalkan', Tw.red200, Tw.red600, filter: 'Dibatalkan'),
        const SizedBox(width: 16),
        stat('Ditangguhkan', 'ditangguhkan', Tw.orange200, Tw.orange600, filter: 'Ditangguhkan'),
      ]),
    ]);
  }

  /// The server refuses answers once the match has kicked off.
  bool _started(Map<String, dynamic> a) {
    final kickoff = _klInstant('${'${a['tarikh']}'.padRight(10).substring(0, 10)}T${text(a['masa'], '00:00:00')}');
    return kickoff != null && !kickoff.isAfter(DateTime.now());
  }

  Widget _card(Map<String, dynamic> a) {
    final status = text(a['status']);
    final started = status == 'Belum Jawab' && _started(a);
    final pending = status == 'Belum Jawab' && !started;
    final crew = (a['rakan_tugasan'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final deadline = text(a['tarikh_notif'], '').isEmpty ? '' : _deadlineText(a);
    const small = TextStyle(fontSize: 12, color: Tw.slate500);
    return WebCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(text(a['nama_kejohanan']),
                  style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate900, fontSize: 14)),
              Text('${text(a['no_perlawanan'])} — ${text(a['kumpulan_tahap'], '')}', style: small),
            ]),
          ),
          const SizedBox(width: 8),
          StatusBadge(status, appointmentTone(status)),
        ]),
        const SizedBox(height: 8),
        Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Tw.slate800)),
        const SizedBox(height: 4),
        Text('${formatDate(a['tarikh'])}, ${text(a['hari'], '')}, ${formatTime(a['masa'])}', style: small),
        Text(text(a['tempat']), style: small),
        Text('Jawatan: ${text(a['jawatan'])}',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Tw.slate700)),
        const SizedBox(height: 4),
        Row(children: [
          StatusBadge(text(a['jenis_kejohanan'], 'Persahabatan'), tournamentTone(text(a['jenis_kejohanan'], '')), small: true),
          const SizedBox(width: 4),
          if (text(a['peringkat_kejohanan'], '').isNotEmpty)
            StatusBadge(text(a['peringkat_kejohanan']), (Tw.amber50, Tw.amber600), small: true),
        ]),
        const SizedBox(height: 12),
        if (pending) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Tw.amber50,
              border: Border.all(color: Tw.amber200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (deadline.isNotEmpty)
                Text('⏰ Jawab sebelum $deadline',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Tw.amber700, height: 1.6)),
              Text(_autoRejectRule(a['jenis_kejohanan']),
                  style: const TextStyle(fontSize: 11, color: Tw.amber700, height: 1.6)),
            ]),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.only(top: 8),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Tw.slate100))),
            child: Row(children: [
              Expanded(
                child: SolidButton(
                    label: 'Terima Tugasan', color: Tw.emerald600, expand: true, onPressed: () => _openAction(a, 'accept')),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlineButton(
                    label: 'Tolak', border: Tw.rose300, fg: Tw.rose600, expand: true, onPressed: () => _openAction(a, 'reject')),
              ),
            ]),
          ),
        ],
        if (started)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Tw.slate50,
              border: Border.all(color: Tw.slate200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'Perlawanan telah bermula. Lantikan ini tidak lagi boleh dijawab; hubungi pegawai yang melantik jika perlu.',
              style: TextStyle(fontSize: 11, color: Tw.slate600, height: 1.6),
            ),
          ),
        if (text(a['sebab_status'], '').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(
                    text: 'Sebab ${status == 'Ditangguhkan' ? 'penangguhan' : 'pembatalan'}: ',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                TextSpan(text: text(a['sebab_status'])),
              ]),
              style: const TextStyle(fontSize: 12, color: Tw.red700),
            ),
          ),
        if (crew.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.only(top: 8),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Tw.slate100))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Pegawai bertugas bersama',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Tw.slate700)),
              const SizedBox(height: 4),
              for (final r in crew) _crewRow(r),
            ]),
          ),
      ]),
    );
  }

  Widget _crewRow(Map<String, dynamic> r) {
    final phone = text(r['no_telefon']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        Expanded(
          child: Text.rich(
            TextSpan(children: [
              TextSpan(text: '${text(r['jawatan'])}: ', style: const TextStyle(fontWeight: FontWeight.w500)),
              TextSpan(text: '${text(r['nama'])}\n'),
              TextSpan(
                text: phone,
                style: phone == '-' ? null : const TextStyle(color: Tw.blue700),
              ),
              TextSpan(text: ' · ${text(r['wilayah_label'])}: ${text(r['wilayah'])}'),
            ]),
            style: const TextStyle(fontSize: 12, color: Tw.slate600, height: 1.4),
          ),
        ),
        if (phone != '-')
          IconButton(
            tooltip: 'Panggil ${text(r['nama'])}',
            visualDensity: VisualDensity.compact,
            onPressed: () => callNumber(context, phone),
            icon: const Icon(Icons.call, size: 18, color: Tw.emerald600),
          ),
      ]),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Tw.slate900 : Tw.slate100,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(label,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: selected ? Colors.white : Tw.slate600)),
        ),
      ),
    );
  }
}

/// Body of the Terima/Tolak modal; pops with the server's message on success.
class _ActionForm extends StatefulWidget {
  const _ActionForm({required this.appointment, required this.action});
  final Map<String, dynamic> appointment;
  final String action;

  @override
  State<_ActionForm> createState() => _ActionFormState();
}

class _ActionFormState extends State<_ActionForm> {
  final _komen = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _komen.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final accept = widget.action == 'accept';
    if (!accept && _komen.text.trim().isEmpty) {
      showToast(context, 'Sila berikan sebab penolakan.', ToastType.error);
      return;
    }
    setState(() => _saving = true);
    try {
      final result = await Api.instance.post('/api/lantikan-jawab.php', {
        'lantikan_id': widget.appointment['id'],
        'action': widget.action,
        'komen': _komen.text,
      });
      if (mounted) Navigator.pop(context, text(result['message'], accept ? 'Tugasan diterima.' : 'Tugasan ditolak.'));
    } on ApiException catch (error) {
      if (mounted) {
        showToast(context, error.message, ToastType.error);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.appointment;
    final accept = widget.action == 'accept';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Tw.slate50, borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(text(a['nama_kejohanan']), style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate800, fontSize: 14)),
          const SizedBox(height: 4),
          Text('${text(a['no_perlawanan'])}: ${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
              style: const TextStyle(color: Tw.slate600, fontSize: 14)),
          const SizedBox(height: 4),
          Text('${formatDate(a['tarikh'])}, ${formatTime(a['masa'])}', style: const TextStyle(color: Tw.slate500, fontSize: 14)),
          const SizedBox(height: 4),
          Text('Jawatan: ${text(a['jawatan'])}',
              style: const TextStyle(fontWeight: FontWeight.w500, color: Tw.slate700, fontSize: 14)),
        ]),
      ),
      const SizedBox(height: 16),
      FieldLabel(accept ? 'Catatan (pilihan)' : 'Sebab Penolakan', required: !accept, small: true),
      TextField(
        controller: _komen,
        maxLines: accept ? 2 : 3,
        style: const TextStyle(fontSize: 14),
        decoration: InputDecoration(hintText: accept ? 'Catatan tambahan...' : 'Nyatakan sebab penolakan...'),
      ),
      const SizedBox(height: 16),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        OutlineButton(label: 'Batal', onPressed: _saving ? null : () => Navigator.pop(context)),
        const SizedBox(width: 12),
        Flexible(
          child: SolidButton(
            label: _saving ? 'Menyimpan...' : (accept ? 'Sahkan Terima' : 'Sahkan Tolak'),
            color: accept ? Tw.emerald600 : Tw.rose500,
            busy: _saving,
            onPressed: _submit,
          ),
        ),
      ]),
    ]);
  }
}

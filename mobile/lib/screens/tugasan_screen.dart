import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// shared/appointment-deadline.ts: late replacements may answer until kickoff.
DateTime? responseDeadline(String kind, DateTime? kickoff, DateTime? notified) {
  if (kickoff == null || notified == null || !notified.isBefore(kickoff)) return null;
  final hours = kind.trim().toLowerCase() == 'liga' ? 48 : 3;
  final cutoff = kickoff.subtract(Duration(hours: hours));
  return notified.isBefore(cutoff) ? cutoff : kickoff;
}

DateTime? _klInstant(String raw) {
  final value = raw.trim().replaceFirst(' ', 'T');
  return value.isEmpty ? null : DateTime.tryParse('$value+08:00');
}

DateTime? kickoffOf(Map<String, dynamic> a) =>
    _klInstant('${'${a['tarikh']}'.padRight(10).substring(0, 10)}T${text(a['masa'], '00:00:00')}');

/// The official's appointments (/api/tugasan.php) with accept/reject.
class TugasanScreen extends StatefulWidget {
  const TugasanScreen({super.key});

  @override
  State<TugasanScreen> createState() => _TugasanScreenState();
}

class _TugasanScreenState extends State<TugasanScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String? _filter;

  bool _started(Map<String, dynamic> a) {
    final kickoff = kickoffOf(a);
    return kickoff != null && !kickoff.isAfter(DateTime.now());
  }

  bool _answerable(Map<String, dynamic> a) => a['status'] == 'Belum Jawab' && !_started(a);

  String _deadline(Map<String, dynamic> a) {
    final at = responseDeadline(text(a['jenis_kejohanan'], ''), kickoffOf(a), _klInstant(text(a['tarikh_notif'], '')));
    return at == null ? '' : formatKl(at);
  }

  List<Map<String, dynamic>> _filtered(List<Map<String, dynamic>> all, String filter) {
    final list = switch (filter) {
      'pending' => all.where(_answerable).toList(),
      'upcoming' => all.where((a) => a['status'] == 'Diterima' && !_started(a)).toList(),
      'past' => all.where((a) => !_answerable(a) && !(a['status'] == 'Diterima' && !_started(a))).toList(),
      _ => all.toList(),
    };
    list.sort((a, b) => '${a['tarikh']} ${a['masa']}'.compareTo('${b['tarikh']} ${b['masa']}'));
    return filter == 'past' || filter == 'all' ? list.reversed.toList() : list;
  }

  /// Opens the Surat Lantikan PDF through a short-lived signed link, so the
  /// phone's browser/PDF viewer can show it without the app's session.
  Future<void> _openLetter(Map<String, dynamic> a) async {
    try {
      final body = await Api.instance.post('/api/surat-lantikan.php', {'id': a['id']});
      final url = text(body['url'], '');
      if (url.isEmpty) throw ApiException('Surat lantikan belum tersedia.');
      // On the web (iPhone app) a new window after a network call is blocked as
      // a pop-up, so the letter opens in place; iOS shows it with a Done button.
      final ok = await launchUrl(Uri.parse(url),
          mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication, webOnlyWindowName: kIsWeb ? '_self' : null);
      if (!ok && mounted) showToast(context, 'Tidak dapat membuka PDF.', ToastType.error);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  Widget _letterButton(Map<String, dynamic> a) => OutlinedButton.icon(
        onPressed: () => _openLetter(a),
        icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
        label: const Text('Surat Lantikan (PDF)'),
        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
      );

  Future<void> _answer(Map<String, dynamic> a, bool accept) async {
    final message = await showAppSheet<String>(
      context,
      title: accept ? 'Terima tugasan?' : 'Tolak tugasan',
      builder: (_) => _AnswerForm(appointment: a, accept: accept),
    );
    if (message != null && mounted) {
      showToast(context, message);
      await _view.currentState?.reload();
    }
  }

  void _details(Map<String, dynamic> a) {
    final crew = (a['rakan_tugasan'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final status = text(a['status']);
    final deadline = _answerable(a) ? _deadline(a) : '';
    showAppSheet<void>(context, builder: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Pill(status, appointmentTone(status)),
        const SizedBox(width: 8),
        Pill(text(a['jenis_kejohanan'], 'Persahabatan'), tournamentTone(text(a['jenis_kejohanan'], ''))),
      ]),
      const SizedBox(height: 12),
      Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      DetailRow(Icons.emoji_events_outlined, 'Kejohanan', text(a['nama_kejohanan'])),
      DetailRow(Icons.badge_outlined, 'Jawatan', text(a['jawatan'])),
      DetailRow(Icons.event_outlined, 'Tarikh & masa', '${formatDayDate(a['tarikh'])}, ${formatTime(a['masa'])}'),
      DetailRow(Icons.place_outlined, 'Tempat', text(a['tempat']),
          trailing: const Icon(Icons.map_outlined, color: Tw.blue700),
          onTap: () => launchUrl(Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(text(a['tempat'], ''))}'),
              mode: LaunchMode.externalApplication)),
      DetailRow(Icons.tag, 'No. perlawanan', '${text(a['no_perlawanan'])}  ${text(a['kumpulan_tahap'], '')}'),
      if (deadline.isNotEmpty) DetailRow(Icons.timer_outlined, 'Jawab sebelum', deadline),
      if (text(a['sebab_status'], '').isNotEmpty) DetailRow(Icons.info_outline, 'Sebab', text(a['sebab_status'])),
      if (text(a['komen'], '').isNotEmpty) DetailRow(Icons.chat_bubble_outline, 'Komen anda', text(a['komen'])),
      if (crew.isNotEmpty) ...[
        const SizedBox(height: 12),
        const Text('Pegawai bertugas bersama', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        for (final r in crew)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(name: text(r['nama'], ''), radius: 20),
            title: Text(text(r['nama']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: Text('${text(r['jawatan'])} · ${text(r['wilayah_label'])}: ${text(r['wilayah'])}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            trailing: text(r['no_telefon']) == '-'
                ? null
                : IconButton.filledTonal(
                    tooltip: 'Panggil',
                    onPressed: () => callNumber(context, text(r['no_telefon'])),
                    icon: const Icon(Icons.call_rounded, color: Tw.emerald700),
                  ),
          ),
      ],
      if (a['status'] == 'Diterima') ...[
        const SizedBox(height: 16),
        _letterButton(a),
      ],
      if (_answerable(a)) ...[
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                _answer(a, false);
              },
              style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600, side: const BorderSide(color: Tw.rose300)),
              child: const Text('Tolak'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: () {
                Navigator.pop(context);
                _answer(a, true);
              },
              style: FilledButton.styleFrom(backgroundColor: Tw.emerald600, foregroundColor: Colors.white),
              child: const Text('Terima'),
            ),
          ),
        ]),
      ],
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      load: () => Api.instance.get('/api/tugasan.php'),
      builder: (context, body, reload) {
        final all = (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        final pendingCount = all.where(_answerable).length;
        final filter = _filter ?? (pendingCount > 0 ? 'pending' : 'upcoming');
        final items = _filtered(all, filter);
        return RefreshList(onRefresh: reload, children: [
          FilterChips<String>(
            options: [
              ('pending', 'Perlu jawapan${pendingCount > 0 ? ' ($pendingCount)' : ''}'),
              ('upcoming', 'Akan datang'),
              ('past', 'Lepas'),
              ('all', 'Semua'),
            ],
            value: filter,
            onChanged: (v) => setState(() => _filter = v),
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            EmptyState(
              icon: Icons.event_available_rounded,
              title: filter == 'pending' ? 'Semua lantikan telah dijawab' : 'Tiada tugasan',
              subtitle: filter == 'pending' ? 'Lantikan baharu akan dimaklumkan melalui notifikasi.' : null,
            ),
          for (final a in items) _card(a),
        ]);
      },
    );
  }

  Widget _card(Map<String, dynamic> a) {
    final status = text(a['status']);
    final answerable = _answerable(a);
    final started = status == 'Belum Jawab' && _started(a);
    final deadline = answerable ? _deadline(a) : '';
    return AppCard(
      accent: answerable ? Tw.pahangYellow : null,
      onTap: () => _details(a),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          DateBlock(a['tarikh'], highlight: answerable),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${formatTime(a['masa'])} · ${text(a['jawatan'])}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
              const SizedBox(height: 2),
              Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.place_outlined, size: 14, color: AppColors.muted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(text(a['tempat']), maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                ),
              ]),
              Text(text(a['nama_kejohanan']), maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ]),
          ),
          if (!answerable) Pill(status, appointmentTone(status)),
        ]),
        if (deadline.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(children: [
            const Icon(Icons.timer_outlined, size: 16, color: Tw.amber700),
            const SizedBox(width: 6),
            Text('Jawab sebelum $deadline',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.amber700)),
          ]),
        ],
        if (started) ...[
          const SizedBox(height: 10),
          const Text('Perlawanan telah bermula — tidak lagi boleh dijawab.',
              style: TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
        if (status == 'Diterima') ...[
          const SizedBox(height: 12),
          _letterButton(a),
        ],
        if (answerable) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _answer(a, false),
                style: OutlinedButton.styleFrom(
                    foregroundColor: Tw.rose600, side: const BorderSide(color: Tw.rose300), minimumSize: const Size(0, 44)),
                child: const Text('Tolak'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: () => _answer(a, true),
                style: FilledButton.styleFrom(
                    backgroundColor: Tw.emerald600, foregroundColor: Colors.white, minimumSize: const Size(0, 44)),
                child: const Text('Terima'),
              ),
            ),
          ]),
        ],
      ]),
    );
  }
}

/// Sheet body for Terima/Tolak; pops with the server's message on success.
class _AnswerForm extends StatefulWidget {
  const _AnswerForm({required this.appointment, required this.accept});
  final Map<String, dynamic> appointment;
  final bool accept;

  @override
  State<_AnswerForm> createState() => _AnswerFormState();
}

class _AnswerFormState extends State<_AnswerForm> {
  final _komen = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _komen.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!widget.accept && _komen.text.trim().isEmpty) {
      showToast(context, 'Sila berikan sebab penolakan.', ToastType.error);
      return;
    }
    setState(() => _saving = true);
    try {
      final result = await Api.instance.post('/api/lantikan-jawab.php', {
        'lantikan_id': widget.appointment['id'],
        'action': widget.accept ? 'accept' : 'reject',
        'komen': _komen.text,
      });
      if (mounted) Navigator.pop(context, text(result['message'], widget.accept ? 'Tugasan diterima.' : 'Tugasan ditolak.'));
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
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          DateBlock(a['tarikh'], highlight: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              Text('${formatTime(a['masa'])} · ${text(a['jawatan'])}',
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              Text(text(a['nama_kejohanan']), style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      LabeledField(
        label: widget.accept ? 'Catatan (pilihan)' : 'Sebab penolakan',
        required: !widget.accept,
        controller: _komen,
        maxLines: 3,
        hint: widget.accept ? 'Catatan tambahan...' : 'Nyatakan sebab penolakan...',
      ),
      FilledButton(
        onPressed: _saving ? null : _submit,
        style: FilledButton.styleFrom(
            backgroundColor: widget.accept ? Tw.emerald600 : Tw.rose600, foregroundColor: Colors.white),
        child: _saving
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(widget.accept ? 'Sahkan terima' : 'Sahkan tolak'),
      ),
      TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: const Text('Batal')),
    ]);
  }
}

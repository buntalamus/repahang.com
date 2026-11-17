import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _endpoint = '/api/rekod-negeri-asal.php';
const originStatuses = {
  'requested': 'Menunggu akses Admin',
  'open': 'Akses dibuka',
  'submitted': 'Menunggu semakan Admin',
  'accepted': 'Diterima Admin',
  'rejected': 'Ditolak Admin',
  'revoked': 'Akses ditutup',
};
List<Map<String, dynamic>> _rows(Object? value) => (value as List? ?? [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();
String _day(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
DateTime _klToday() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 8));
  return DateTime(now.year, now.month, now.day);
}

String _status(Map<String, dynamic> r, String today) =>
    r['status'] == 'open' &&
        text(r['expires_on'], '').isNotEmpty &&
        '${r['expires_on']}'.compareTo(today) < 0
    ? 'Akses tamat'
    : originStatuses[r['status']] ?? text(r['status']);
Tone _tone(String status) => status == 'accepted'
    ? (Tw.emerald50, Tw.emerald700)
    : ['rejected', 'revoked'].contains(status)
    ? (Tw.rose50, Tw.rose700)
    : (Tw.amber50, Tw.amber700);

Future<(List<int>, String)?> _proof(BuildContext context) async {
  try {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024 || bytes.isEmpty) {
      if (context.mounted) {
        showToast(
          context,
          'Pilih PDF/JPG/PNG yang boleh dibaca, maksimum 5 MB.',
          ToastType.warning,
        );
      }
      return null;
    }
    return (bytes, file.name);
  } catch (_) {
    if (context.mounted) {
      showToast(
        context,
        'Fail tidak dapat dibaca. Sila pilih semula.',
        ToastType.error,
      );
    }
    return null;
  }
}

/// Both roles use the same authenticated API; only Admin receives review controls.
class RekodNegeriAsalScreen extends StatefulWidget {
  const RekodNegeriAsalScreen({super.key, this.admin = false});
  final bool admin;
  @override
  State<RekodNegeriAsalScreen> createState() => _RekodNegeriAsalScreenState();
}

class _RekodNegeriAsalScreenState extends State<RekodNegeriAsalScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _filter = '';
  int _page = 1;
  Future<Map<String, dynamic>> _load() => Api.instance.get(_endpoint, {
    'page': _page,
    if (_filter.isNotEmpty) 'status': _filter,
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Rekod Negeri Asal')),
    body: AsyncView<Map<String, dynamic>>(
      key: _view,
      load: _load,
      builder: (context, data, reload) {
        final items = _rows(data['requests']);
        final pages =
            int.tryParse('${(data['pagination'] as Map?)?['total_pages']}') ??
            1;
        final states = (data['states'] as List? ?? [])
            .map((e) => '$e')
            .toList();
        return RefreshList(
          onRefresh: reload,
          children: [
            const Text(
              'Rekod sebelum berpindah ke Pahang. Hanya rekod yang diterima Admin dikira untuk kelayakan tahunan mengikut tahun perlawanan.',
            ),
            const SizedBox(height: 16),
            if (!widget.admin)
              FilledButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Mohon akses khas'),
                onPressed: () async {
                  await Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => _OriginRequestForm(states: states),
                    ),
                  );
                  _page = 1;
                  await reload();
                },
              ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _filter,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Tapis status'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Semua status')),
                for (final entry in originStatuses.entries)
                  DropdownMenuItem(value: entry.key, child: Text(entry.value)),
              ],
              onChanged: (value) {
                setState(() {
                  _filter = value ?? '';
                  _page = 1;
                });
                reload();
              },
            ),
            const SizedBox(height: 16),
            if (items.isEmpty)
              const EmptyState(
                icon: Icons.move_to_inbox_outlined,
                title: 'Tiada permohonan rekod negeri asal',
              ),
            for (final row in items)
              AppCard(
                onTap: () async {
                  await Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => _OriginDetail(
                        id: row['id'] as int,
                        admin: widget.admin,
                      ),
                    ),
                  );
                  await reload();
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.admin
                          ? '${text(row['referee_name'])} · ${text(row['origin_state'])}'
                          : text(row['origin_state']),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${formatDate(row['date_from'])} – ${formatDate(row['date_to'])}',
                    ),
                    Text('${row['record_count']} rekod'),
                    const SizedBox(height: 8),
                    Pill(
                      _status(row, '${data['today']}'),
                      _tone('${row['status']}'),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Buka permohonan →',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              children: [
                OutlinedButton(
                  onPressed: _page > 1
                      ? () {
                          _page--;
                          reload();
                        }
                      : null,
                  child: const Text('Sebelum'),
                ),
                Text('Halaman $_page / ${pages < 1 ? 1 : pages}'),
                OutlinedButton(
                  onPressed: _page < pages
                      ? () {
                          _page++;
                          reload();
                        }
                      : null,
                  child: const Text('Seterusnya'),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

/// Date picker used by applicant, Admin and historical match forms.
class OriginDateField extends StatelessWidget {
  const OriginDateField({
    super.key,
    required this.controller,
    required this.label,
    this.firstDate,
    this.lastDate,
  });
  final TextEditingController controller;
  final String label;
  final DateTime? firstDate;
  final DateTime? lastDate;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: controller,
      readOnly: true,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today_outlined),
      ),
      validator: (value) => (value ?? '').isEmpty ? 'Sila pilih tarikh' : null,
      onTap: () async {
        final first = firstDate ?? DateTime(1900);
        final last = lastDate ?? _klToday();
        if (last.isBefore(first)) {
          showToast(context, 'Semak julat tarikh dahulu.', ToastType.warning);
          return;
        }
        var initial = parseDate(controller.text) ?? last;
        if (initial.isBefore(first)) initial = first;
        if (initial.isAfter(last)) initial = last;
        final picked = await showDatePicker(
          context: context,
          firstDate: first,
          lastDate: last,
          initialDate: initial,
        );
        if (picked != null) controller.text = _day(picked);
      },
    ),
  );
}

Widget _field(
  TextEditingController controller,
  String label, {
  bool required = true,
  int max = 255,
  int lines = 1,
}) => Padding(
  padding: const EdgeInsets.only(bottom: 14),
  child: TextFormField(
    controller: controller,
    maxLength: max,
    maxLines: lines,
    decoration: InputDecoration(labelText: label, counterText: ''),
    validator: (value) => required && (value ?? '').trim().isEmpty
        ? 'Medan ini wajib diisi'
        : null,
  ),
);

class _OriginRequestForm extends StatefulWidget {
  const _OriginRequestForm({required this.states});
  final List<String> states;
  @override
  State<_OriginRequestForm> createState() => _OriginRequestFormState();
}

class _OriginRequestFormState extends State<_OriginRequestForm> {
  final _form = GlobalKey<FormState>();
  final _transfer = TextEditingController(),
      _from = TextEditingController(),
      _to = TextEditingController();
  final _verifier = TextEditingController(), _notes = TextEditingController();
  String? _state;
  (List<int>, String)? _file;
  bool _busy = false;
  @override
  void dispose() {
    for (final c in [_transfer, _from, _to, _verifier, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    if (_file == null) {
      showToast(
        context,
        'Lampirkan dokumen pengesahan PP negeri asal.',
        ToastType.warning,
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final body = await Api.instance.postForm(
        _endpoint,
        {
          'action': 'request',
          'origin_state': _state!,
          'transfer_date': _transfer.text,
          'date_from': _from.text,
          'date_to': _to.text,
          'verifier_name': _verifier.text,
          'notes': _notes.text,
        },
        files: {'proof': _file!},
      );
      if (mounted) {
        showToast(context, '${body['message']}');
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Mohon akses khas')),
    body: AbsorbPointer(
      absorbing: _busy,
      child: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Lampirkan buku log atau pengesahan PP negeri asal. Gabungkan halaman buku log dalam satu PDF jika perlu.',
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _state,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Negeri asal *'),
              items: [
                for (final s in widget.states)
                  DropdownMenuItem(value: s, child: Text(s)),
              ],
              validator: (v) => v == null ? 'Pilih negeri asal' : null,
              onChanged: (v) => _state = v,
            ),
            const SizedBox(height: 14),
            OriginDateField(
              controller: _transfer,
              label: 'Tarikh mula berdaftar di Pahang *',
            ),
            OriginDateField(controller: _from, label: 'Tarikh rekod bermula *'),
            OriginDateField(controller: _to, label: 'Tarikh rekod berakhir *'),
            _field(_verifier, 'Nama PP pengesah negeri asal *'),
            _field(_notes, 'Catatan', required: false, max: 1000, lines: 3),
            OutlinedButton.icon(
              icon: const Icon(Icons.attach_file),
              label: Text(
                _file?.$2 ?? 'Pilih bukti PDF/JPG/PNG (maksimum 5 MB)',
              ),
              onPressed: () async {
                final file = await _proof(context);
                if (file != null && mounted) setState(() => _file = file);
              },
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _send,
              child: Text(_busy ? 'Menghantar…' : 'Hantar kepada Admin'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _OriginDetail extends StatefulWidget {
  const _OriginDetail({required this.id, required this.admin});
  final int id;
  final bool admin;
  @override
  State<_OriginDetail> createState() => _OriginDetailState();
}

class _OriginDetailState extends State<_OriginDetail> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  bool _busy = false;
  Future<Map<String, dynamic>> _load() =>
      Api.instance.get(_endpoint, {'id': widget.id});
  Future<bool> _act(
    Map<String, dynamic> row,
    String action, [
    Map<String, dynamic> fields = const {},
  ]) async {
    setState(() => _busy = true);
    try {
      final res = await Api.instance.post(_endpoint, {
        'id': widget.id,
        'revision': row['revision'],
        'action': action,
        ...fields,
      });
      if (mounted) {
        showToast(context, '${res['message']}');
        await _view.currentState?.reload();
      }
      return true;
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, ToastType.error);
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _replace(Map<String, dynamic> row) async {
    final file = await _proof(context);
    if (file == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final res = await Api.instance.postForm(
        _endpoint,
        {
          'id': '${widget.id}',
          'revision': '${row['revision']}',
          'action': 'replace_proof',
        },
        files: {'proof': file},
      );
      if (mounted) {
        showToast(context, '${res['message']}');
        await _view.currentState?.reload();
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Permohonan #${widget.id}')),
    body: AsyncView<Map<String, dynamic>>(
      key: _view,
      load: _load,
      builder: (context, data, reload) {
        final row = Map<String, dynamic>.from(data['request'] as Map);
        final records = _rows(data['records']);
        final status = '${row['status']}';
        final active = row['access_active'] == true;
        return AbsorbPointer(
          absorbing: _busy,
          child: RefreshList(
            onRefresh: reload,
            children: [
              if (_busy) const LinearProgressIndicator(),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${text(row['referee_name'])} · ${text(row['origin_state'])}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Pill(_status(row, _day(_klToday())), _tone(status)),
                    DetailRow(
                      Icons.calendar_month,
                      'Berdaftar di Pahang',
                      formatDate(row['transfer_date']),
                    ),
                    DetailRow(
                      Icons.date_range,
                      'Julat rekod',
                      '${formatDate(row['date_from'])} – ${formatDate(row['date_to'])}',
                    ),
                    DetailRow(
                      Icons.timer_outlined,
                      'Akses sehingga',
                      '${formatDate(row['expires_on'])} (waktu Malaysia)',
                    ),
                    DetailRow(
                      Icons.verified_user_outlined,
                      'PP pengesah negeri asal',
                      text(row['verifier_name']),
                    ),
                    if (row['granted_by_name'] != null)
                      DetailRow(
                        Icons.key,
                        'Akses dibuka oleh',
                        text(row['granted_by_name']),
                      ),
                    if (row['reviewed_by_name'] != null)
                      DetailRow(
                        Icons.admin_panel_settings_outlined,
                        'Semakan Admin',
                        '${text(row['reviewed_by_name'])} · ${formatDate(row['reviewed_at'])}',
                      ),
                    if (text(row['notes'], '').isNotEmpty)
                      DetailRow(
                        Icons.notes,
                        'Catatan pengadil',
                        text(row['notes']),
                      ),
                    if (text(row['review_notes'], '').isNotEmpty)
                      DetailRow(
                        Icons.comment_outlined,
                        'Catatan Admin',
                        text(row['review_notes']),
                      ),
                    OutlinedButton.icon(
                      icon: const Icon(Icons.download),
                      label: const Text('Muat turun bukti sokongan'),
                      onPressed: () => downloadAndOpen(
                        context,
                        _endpoint,
                        query: {'id': widget.id, 'action': 'proof'},
                        fallbackName: 'bukti-negeri-asal.pdf',
                      ),
                    ),
                    if (!widget.admin && (status == 'requested' || active))
                      TextButton.icon(
                        icon: const Icon(Icons.attach_file),
                        onPressed: () => _replace(row),
                        label: const Text('Ganti dokumen sokongan'),
                      ),
                    if (status == 'accepted')
                      const Text(
                        'Disahkan PP negeri asal · Diterima Admin Pahang. Rekod dikunci dan dikira mengikut tahun perlawanan.',
                      ),
                    if (status == 'open' && !active)
                      const Text(
                        'Akses telah tamat. Hubungi Admin untuk membuka semula tempoh mengisi.',
                      ),
                  ],
                ),
              ),
              if (widget.admin && status != 'accepted')
                _OriginReview(
                  key: ValueKey(row['revision']),
                  row: row,
                  onAction: (action, fields) => _act(row, action, fields),
                ),
              SectionTitle('Senarai perlawanan (${records.length})'),
              if (records.isEmpty) const Text('Belum ada rekod dimasukkan.'),
              for (final rec in records)
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${formatDate(rec['tarikh'])}${rec['masa'] == null ? '' : ' · ${rec['masa']}'}',
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      Text(
                        '${rec['home_team']} lwn ${rec['away_team']}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text('${rec['nama_kejohanan']} · ${rec['jenis']}'),
                      Text('${rec['tempat']} · ${rec['jawatan']}'),
                      if (!widget.admin && active)
                        TextButton(
                          onPressed: () => _act(row, 'delete_record', {
                            'record_id': rec['id'],
                          }),
                          child: const Text('Padam draf'),
                        ),
                    ],
                  ),
                ),
              if (!widget.admin && active) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  icon: const Icon(Icons.add),
                  label: const Text('Tambah rekod perlawanan'),
                  onPressed: () async {
                    await Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => _OriginRecordForm(row: row),
                      ),
                    );
                    await reload();
                  },
                ),
                const SizedBox(height: 12),
                const Text(
                  'Pastikan senarai sepadan dengan bukti. Senarai dikunci selepas dihantar. Hanya rekod diterima Admin dikira untuk kelayakan tahunan.',
                ),
                FilledButton(
                  onPressed: records.isEmpty ? null : () => _act(row, 'submit'),
                  child: Text('Hantar ${records.length} rekod kepada Admin'),
                ),
              ],
            ],
          ),
        );
      },
    ),
  );
}

class _OriginReview extends StatefulWidget {
  const _OriginReview({super.key, required this.row, required this.onAction});
  final Map<String, dynamic> row;
  final Future<bool> Function(String, Map<String, dynamic>) onAction;
  @override
  State<_OriginReview> createState() => _OriginReviewState();
}

class _OriginReviewState extends State<_OriginReview> {
  late final _from = TextEditingController(text: '${widget.row['date_from']}');
  late final _to = TextEditingController(text: '${widget.row['date_to']}');
  final _expires = TextEditingController(
    text: _day(_klToday().add(const Duration(days: 30))),
  );
  final _notes = TextEditingController();
  @override
  void dispose() {
    for (final c in [_from, _to, _expires, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _act(String action) async {
    if (action != 'grant' && _notes.text.trim().isEmpty) {
      showToast(
        context,
        'Isi catatan semakan atau sebab keputusan.',
        ToastType.warning,
      );
      return;
    }
    await widget.onAction(action, {
      'date_from': _from.text,
      'date_to': _to.text,
      'expires_on': _expires.text,
      'notes': _notes.text,
    });
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.row['status'];
    final last = parseDate(widget.row['transfer_date'])!
        .subtract(const Duration(days: 1));
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Kawalan Admin'),
          if (status != 'submitted') ...[
            OriginDateField(
              controller: _from,
              label: 'Tarikh rekod bermula',
              lastDate: last,
            ),
            OriginDateField(
              controller: _to,
              label: 'Tarikh rekod berakhir',
              lastDate: last,
            ),
            OriginDateField(
              controller: _expires,
              label: 'Tarikh tamat akses (maksimum 90 hari)',
              firstDate: _klToday(),
              lastDate: _klToday().add(const Duration(days: 90)),
            ),
          ],
          _field(
            _notes,
            'Catatan semakan / sebab keputusan',
            required: false,
            max: 1000,
            lines: 3,
          ),
          if (status != 'submitted')
            FilledButton(
              onPressed: () => _act('grant'),
              child: Text(
                status == 'open' ? 'Kemas kini akses' : 'Buka akses khas',
              ),
            ),
          if (status == 'submitted')
            FilledButton(
              onPressed: () => _act('accept'),
              child: const Text('Terima semua rekod selepas semakan bukti'),
            ),
          if (status == 'requested' || status == 'submitted')
            OutlinedButton(
              onPressed: () => _act('reject'),
              child: const Text('Tolak dengan sebab'),
            ),
          if (status == 'open')
            OutlinedButton(
              onPressed: () => _act('revoke'),
              child: const Text('Tutup akses'),
            ),
        ],
      ),
    );
  }
}

class _OriginRecordForm extends StatefulWidget {
  const _OriginRecordForm({required this.row});
  final Map<String, dynamic> row;
  @override
  State<_OriginRecordForm> createState() => _OriginRecordFormState();
}

class _OriginRecordFormState extends State<_OriginRecordForm> {
  final _form = GlobalKey<FormState>();
  final _date = TextEditingController(), _time = TextEditingController();
  final _kind = TextEditingController(),
      _tournament = TextEditingController(),
      _venue = TextEditingController();
  final _home = TextEditingController(), _away = TextEditingController();
  String? _position;
  bool _busy = false;
  @override
  void dispose() {
    for (final c in [_date, _time, _kind, _tournament, _venue, _home, _away]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final result = await Api.instance.post(_endpoint, {
        'action': 'add_record',
        'id': widget.row['id'],
        'revision': widget.row['revision'],
        'tarikh': _date.text,
        'masa': _time.text,
        'jenis': _kind.text,
        'nama_kejohanan': _tournament.text,
        'tempat': _venue.text,
        'home_team': _home.text,
        'away_team': _away.text,
        'jawatan': _position,
      });
      if (mounted) {
        showToast(context, '${result['message']}');
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Tambah rekod negeri asal')),
    body: AbsorbPointer(
      absorbing: _busy,
      child: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Isi penglibatan diri sendiri seperti dalam dokumen pengesahan. Maksimum 500 rekod bagi satu permohonan.',
            ),
            const SizedBox(height: 16),
            OriginDateField(
              controller: _date,
              label: 'Tarikh perlawanan *',
              firstDate: parseDate(widget.row['date_from']),
              lastDate: parseDate(widget.row['date_to']),
            ),
            TextFormField(
              controller: _time,
              readOnly: true,
              decoration: const InputDecoration(
                labelText: 'Masa (jika ada)',
                suffixIcon: Icon(Icons.schedule),
              ),
              onTap: () async {
                final time = await showTimePicker(
                  context: context,
                  initialTime: const TimeOfDay(hour: 16, minute: 0),
                );
                if (time != null) {
                  _time.text =
                      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                }
              },
            ),
            const SizedBox(height: 14),
            _field(_kind, 'Jenis perlawanan *', max: 60),
            _field(_tournament, 'Nama kejohanan *'),
            _field(_home, 'Pasukan tuan rumah *'),
            _field(_away, 'Pasukan pelawat *'),
            _field(_venue, 'Tempat *'),
            DropdownButtonFormField<String>(
              initialValue: _position,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Jawatan sendiri *'),
              items: [
                for (final p in const [
                  'Pengadil',
                  'Penolong Pengadil 1',
                  'Penolong Pengadil 2',
                  'Pengadil Ke-4',
                ])
                  DropdownMenuItem(value: p, child: Text(p)),
              ],
              validator: (v) => v == null ? 'Pilih jawatan' : null,
              onChanged: (v) => _position = v,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _send,
              child: Text(_busy ? 'Menyimpan…' : 'Simpan rekod draf'),
            ),
          ],
        ),
      ),
    ),
  );
}

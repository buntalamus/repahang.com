import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _jawatanOptions = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pengadil Ke-4'];
const _jenisOptions = ['Liga', 'Piala', 'Persahabatan', 'Lain-lain'];
const _cuacaOptions = ['Cerah', 'Mendung', 'Hujan Renyai', 'Hujan Lebat', 'Panas Terik', 'Berangin'];

/// "Tambah Perlawanan Baharu" from features/pengadil/matches: the same fields
/// and the same {action: 'add', …} payload to /api/pengadil-match-manage.php.
class TambahPerlawananScreen extends StatefulWidget {
  const TambahPerlawananScreen({super.key});

  @override
  State<TambahPerlawananScreen> createState() => _TambahPerlawananScreenState();
}

class _Official {
  _Official(this.jawatan);
  String jawatan;
  Map<String, dynamic>? referee;
}

class _TambahPerlawananScreenState extends State<TambahPerlawananScreen> {
  final _fields = {
    for (final key in ['nama_kejohanan', 'tempat', 'home_team', 'away_team',
      'skor_ht_home', 'skor_ht_away', 'skor_ft_home', 'skor_ft_away',
      'skor_et_home', 'skor_et_away', 'skor_ps_home', 'skor_ps_away'])
      key: TextEditingController(),
  };
  DateTime? _tarikh;
  TimeOfDay? _masa;
  String? _jenis;
  String? _cuaca;
  String? _daerahId;
  List<Map<String, dynamic>> _districts = [];
  List<Map<String, dynamic>> _referees = [];
  final _officials = [for (final j in _jawatanOptions) _Official(j)];
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    Api.instance.get('/api/districts.php').then((body) {
      if (mounted) setState(() => _districts = _rows(body));
    }, onError: (_) {});
    Api.instance.get('/api/get-active-referees.php').then((body) {
      if (mounted) setState(() => _referees = _rows(body));
    }, onError: (_) {});
  }

  static List<Map<String, dynamic>> _rows(Map<String, dynamic> body) =>
      (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  int? _score(String key) => int.tryParse(_fields[key]!.text.trim());

  Future<void> _submit() async {
    if (_tarikh == null || _fields['home_team']!.text.trim().isEmpty || _fields['away_team']!.text.trim().isEmpty) {
      showToast(context, 'Sila isi maklumat perlawanan yang diperlukan.', ToastType.warning);
      return;
    }
    final filled = _officials.where((o) => o.referee != null).toList();
    if (filled.isEmpty) {
      showToast(context, 'Sila pilih sekurang-kurangnya seorang pegawai.', ToastType.warning);
      return;
    }
    if (_daerahId == null) {
      showToast(context, 'Sila pilih daerah perlawanan.', ToastType.warning);
      return;
    }
    String two(int v) => v.toString().padLeft(2, '0');
    setState(() => _submitting = true);
    try {
      final result = await Api.instance.post('/api/pengadil-match-manage.php', {
        'action': 'add',
        'tarikh': '${_tarikh!.year}-${two(_tarikh!.month)}-${two(_tarikh!.day)}',
        'masa': _masa == null ? null : '${two(_masa!.hour)}:${two(_masa!.minute)}',
        'jenis': _jenis,
        'nama_kejohanan': _fields['nama_kejohanan']!.text.trim().isEmpty ? null : _fields['nama_kejohanan']!.text.trim(),
        'tempat': _fields['tempat']!.text.trim(),
        'home_team': _fields['home_team']!.text.trim(),
        'away_team': _fields['away_team']!.text.trim(),
        'daerah_perlawanan_id': int.parse(_daerahId!),
        'cuaca': _cuaca,
        for (final key in ['skor_ht_home', 'skor_ht_away', 'skor_ft_home', 'skor_ft_away',
          'skor_et_home', 'skor_et_away', 'skor_ps_home', 'skor_ps_away'])
          key: _score(key),
        'officials': [for (final o in filled) {'user_id': o.referee!['id'], 'jawatan': o.jawatan}],
      });
      if (mounted) Navigator.pop(context, text(result['message'], 'Perlawanan berjaya ditambah.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickReferee(_Official slot) async {
    final excluded = _officials.where((o) => o != slot && o.referee != null).map((o) => o.referee!['id']).toSet();
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RefereePicker(referees: _referees.where((r) => !excluded.contains(r['id'])).toList()),
    );
    if (picked != null) setState(() => slot.referee = picked);
  }

  Widget _label(String label, {bool required = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: label),
          if (required) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
        ]), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
      );

  Widget _text(String key, String label, {bool required = false}) =>
      LabeledField(label: label, controller: _fields[key], required: required);

  Widget _dropdown(String label, String? value, List<(String, String)> options, ValueChanged<String?> onChanged,
          {bool required = false}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _label(label, required: required),
          DropdownButtonFormField<String>(
            initialValue: value,
            isExpanded: true,
            hint: const Text('-- Pilih --', style: TextStyle(fontSize: 14)),
            items: [for (final (v, l) in options) DropdownMenuItem(value: v, child: Text(l, style: const TextStyle(fontSize: 14)))],
            onChanged: onChanged,
          ),
        ]),
      );

  Widget _picker(String label, String value, VoidCallback onTap, {bool required = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _label(label, required: required),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: InputDecorator(
              decoration: const InputDecoration(suffixIcon: Icon(Icons.expand_more, color: Tw.gray400)),
              child: Text(value, style: TextStyle(fontSize: 14, color: value.startsWith('--') ? Tw.gray400 : Tw.gray900)),
            ),
          ),
        ]),
      );

  Widget _scoreRow(String label, String prefix) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700))),
          Expanded(child: TextField(controller: _fields['${prefix}_home'], keyboardType: TextInputType.number,
              textAlign: TextAlign.center, decoration: const InputDecoration(hintText: 'Tuan rumah'))),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('-')),
          Expanded(child: TextField(controller: _fields['${prefix}_away'], keyboardType: TextInputType.number,
              textAlign: TextAlign.center, decoration: const InputDecoration(hintText: 'Pelawat'))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    String two(int v) => v.toString().padLeft(2, '0');
    return Scaffold(
      appBar: AppBar(title: const Text('Tambah perlawanan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _text('home_team', 'Pasukan Tuan Rumah', required: true),
            _text('away_team', 'Pasukan Pelawat', required: true),
            _picker('Tarikh', _tarikh == null ? '-- Pilih tarikh --' : formatDate('${_tarikh!.year}-${two(_tarikh!.month)}-${two(_tarikh!.day)}'),
                () async {
              // A played match, recorded within 14 days (the server's rule), in Malaysia time.
              final kl = DateTime.now().toUtc().add(const Duration(hours: 8));
              final today = DateTime(kl.year, kl.month, kl.day);
              final picked = await showDatePicker(context: context, firstDate: today.subtract(const Duration(days: 14)),
                  lastDate: today, initialDate: _tarikh ?? today);
              if (picked != null) setState(() => _tarikh = picked);
            }, required: true),
            _picker('Masa', _masa == null ? '-- Pilih masa --' : '${two(_masa!.hour)}:${two(_masa!.minute)}', () async {
              final picked = await showTimePicker(context: context, initialTime: _masa ?? const TimeOfDay(hour: 17, minute: 0));
              if (picked != null) setState(() => _masa = picked);
            }),
            _dropdown('Jenis Perlawanan', _jenis, [for (final j in _jenisOptions) (j, j)], (v) => setState(() => _jenis = v)),
            _text('nama_kejohanan', 'Nama Kejohanan'),
            _text('tempat', 'Tempat'),
            _dropdown('Daerah Perlawanan', _daerahId,
                [for (final d in _districts) ('${d['id']}', text(d['nama']))], (v) => setState(() => _daerahId = v),
                required: true),
            _dropdown('Cuaca', _cuaca, [for (final c in _cuacaOptions) (c, c)], (v) => setState(() => _cuaca = v)),
          ]),
        ),
        AppCard(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Keputusan', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            _scoreRow('Separuh masa', 'skor_ht'),
            _scoreRow('Penuh masa', 'skor_ft'),
            _scoreRow('Masa tambahan', 'skor_et'),
            _scoreRow('Sepakan penalti', 'skor_ps'),
          ]),
        ),
        AppCard(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Pegawai perlawanan', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            for (final o in _officials)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  SizedBox(width: 120, child: Text(o.jawatan, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700))),
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickReferee(o),
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: InputDecoration(
                          suffixIcon: o.referee == null
                              ? const Icon(Icons.search, color: Tw.gray400, size: 20)
                              : IconButton(
                                  icon: const Icon(Icons.close, size: 18, color: Tw.gray400),
                                  onPressed: () => setState(() => o.referee = null),
                                ),
                        ),
                        child: Text(o.referee == null ? 'Cari pegawai...' : text(o.referee!['nama_penuh']),
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 14, color: o.referee == null ? Tw.gray400 : Tw.gray900)),
                      ),
                    ),
                  ),
                ]),
              ),
          ]),
        ),
        const SizedBox(height: 8),
      ]),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                : const Text('Hantar untuk pengesahan'),
          ),
        ),
      ),
    );
  }
}

class _RefereePicker extends StatefulWidget {
  const _RefereePicker({required this.referees});
  final List<Map<String, dynamic>> referees;

  @override
  State<_RefereePicker> createState() => _RefereePickerState();
}

class _RefereePickerState extends State<_RefereePicker> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final q = _search.toLowerCase();
    final list = q.length < 2
        ? <Map<String, dynamic>>[]
        : widget.referees.where((r) => [r['nama_penuh'], r['daerah'], r['persatuan_nama'], r['jenis_pengadil']]
            .any((v) => '${v ?? ''}'.toLowerCase().contains(q))).take(50).toList();
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: TextField(
            autofocus: true,
            onChanged: (value) => setState(() => _search = value),
            decoration: const InputDecoration(
              hintText: 'Taip sekurang-kurangnya 2 huruf nama...',
              prefixIcon: Icon(Icons.search, color: Tw.gray400, size: 20),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final r = list[index];
              return ListTile(
                onTap: () => Navigator.pop(context, r),
                title: Text(text(r['nama_penuh']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                subtitle: Text('${text(r['jenis_pengadil'])} · ${text(r['persatuan_nama'] ?? r['daerah'])}',
                    style: const TextStyle(fontSize: 12, color: Tw.slate500)),
              );
            },
          ),
        ),
      ]),
    );
  }
}

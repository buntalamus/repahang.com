import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

// Same choices as the website's schedule form (lantikan-pengadil.component.ts).
const _kategoriList = ['Terbuka', 'B11', 'B12', 'B14', 'B15', 'B16', 'B18', 'B19'];
const _peringkatList = ['Kumpulan', 'Liga', 'XY', 'Suku Akhir', 'Separuh Akhir', 'Ke 3/4', 'Akhir', 'Persahabatan'];

/// Adds one match to a tournament schedule: POST /api/jadual-perlawanan.php,
/// the same call as the website. The server numbers the match when the
/// number is left blank and checks the PP Daerah's district.
class TambahJadualScreen extends StatefulWidget {
  const TambahJadualScreen({super.key, required this.tournament});
  final Map<String, dynamic> tournament;

  @override
  State<TambahJadualScreen> createState() => _TambahJadualScreenState();
}

class _TambahJadualScreenState extends State<TambahJadualScreen> {
  final _home = TextEditingController();
  final _away = TextEditingController();
  final _tempat = TextEditingController();
  final _kumpulan = TextEditingController();
  final _nombor = TextEditingController();
  DateTime? _tarikh;
  TimeOfDay? _masa;
  String _kategori = '';
  String? _peringkat;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // Start inside the tournament's dates when it has not ended yet.
    final start = parseDate(widget.tournament['tarikh_mula']);
    final today = DateTime.now();
    _tarikh = start != null && start.isAfter(today) ? start : null;
  }

  @override
  void dispose() {
    for (final c in [_home, _away, _tempat, _kumpulan, _nombor]) {
      c.dispose();
    }
    super.dispose();
  }

  static String _two(int v) => v.toString().padLeft(2, '0');

  Future<void> _save() async {
    if (_tarikh == null || _masa == null) {
      showToast(context, 'Sila pilih tarikh dan masa perlawanan.', ToastType.warning);
      return;
    }
    if (_home.text.trim().isEmpty || _away.text.trim().isEmpty) {
      showToast(context, 'Sila isi pasukan tuan rumah dan pelawat.', ToastType.warning);
      return;
    }
    setState(() => _saving = true);
    try {
      final result = await Api.instance.post('/api/jadual-perlawanan.php', {
        'kejohanan_id': widget.tournament['id'],
        'no_perlawanan': _nombor.text.trim(),
        'tarikh': '${_tarikh!.year}-${_two(_tarikh!.month)}-${_two(_tarikh!.day)}',
        'masa': '${_two(_masa!.hour)}:${_two(_masa!.minute)}',
        'kategori': _kategori,
        'peringkat': _peringkat ?? '',
        'kumpulan': _kumpulan.text.trim(),
        'pasukan_home': _home.text.trim(),
        'pasukan_away': _away.text.trim(),
        'tempat': _tempat.text.trim(),
      });
      if (mounted) {
        final number = text(result['no_perlawanan'], '');
        Navigator.pop(context, '${text(result['message'], 'Perlawanan berjaya ditambah.')}${number.isEmpty ? '' : ' ($number)'}');
      }
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _picker(String label, String value, IconData icon, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: label),
            const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
          ]), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
          const SizedBox(height: 6),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: InputDecorator(
              decoration: InputDecoration(prefixIcon: Icon(icon)),
              child: Text(value, style: TextStyle(fontSize: 15, color: value.startsWith('Pilih') ? Tw.slate400 : AppColors.text)),
            ),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tambah perlawanan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                : const Text('Simpan perlawanan'),
          ),
        ),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          color: AppColors.black,
          child: Row(children: [
            const Icon(Icons.emoji_events_rounded, color: Tw.pahangYellow),
            const SizedBox(width: 12),
            Expanded(
              child: Text(text(widget.tournament['nama']),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ]),
        ),
        AppCard(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _picker('Tarikh', _tarikh == null ? 'Pilih tarikh' : formatDayDate(
                '${_tarikh!.year}-${_two(_tarikh!.month)}-${_two(_tarikh!.day)}'), Icons.event_outlined, () async {
              final now = DateTime.now();
              final picked = await showDatePicker(context: context, initialDate: _tarikh ?? now,
                  firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 2));
              if (picked != null) setState(() => _tarikh = picked);
            }),
            _picker('Masa', _masa == null ? 'Pilih masa' : '${_two(_masa!.hour)}:${_two(_masa!.minute)}',
                Icons.schedule_rounded, () async {
              final picked = await showTimePicker(context: context, initialTime: _masa ?? const TimeOfDay(hour: 17, minute: 0));
              if (picked != null) setState(() => _masa = picked);
            }),
            LabeledField(label: 'Pasukan tuan rumah', controller: _home, required: true),
            LabeledField(label: 'Pasukan pelawat', controller: _away, required: true),
            LabeledField(label: 'Tempat', controller: _tempat, hint: 'Contoh: Stadium Darul Makmur'),
          ]),
        ),
        AppCard(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Kategori', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
            const SizedBox(height: 6),
            FilterChips<String>(
              options: [('', 'Tiada'), for (final k in _kategoriList) (k, k)],
              value: _kategori,
              onChanged: (v) => setState(() => _kategori = v),
            ),
            const SizedBox(height: 16),
            const Text('Peringkat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _peringkat,
              isExpanded: true,
              hint: const Text('Pilih peringkat (pilihan)'),
              items: [for (final p in _peringkatList) DropdownMenuItem(value: p, child: Text(p))],
              onChanged: (v) => setState(() => _peringkat = v),
            ),
            const SizedBox(height: 16),
            LabeledField(label: 'Kumpulan', controller: _kumpulan, hint: 'Contoh: A'),
            LabeledField(label: 'No. perlawanan', controller: _nombor,
                hint: 'Kosongkan untuk penomboran automatik'),
          ]),
        ),
      ]),
    );
  }
}

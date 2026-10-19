import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _tahap = [
  ('Normal', 'Perlawanan normal, sedikit situasi mencabar'),
  ('Susah', 'Perlawanan sukar dengan beberapa keputusan sukar'),
  ('Sangat Susah', 'Perlawanan sangat sukar dengan banyak situasi sukar'),
];
const _cuaca = ['Cerah', 'Mendung', 'Hujan Renyai', 'Hujan Lebat', 'Panas Terik', 'Berangin'];
const _prestasi = ['Sangat Baik', 'Baik', 'Memuaskan', 'Tidak Memuaskan'];
const _skala = [
  ('9.0 – 10', 'Sangat baik, banyak keputusan sukar dibuat dengan betul'),
  ('8.3 – 8.9', 'Baik, banyak keputusan dijangka dibuat dengan betul'),
  ('8.0 – 8.2', 'Baik dengan beberapa perkara untuk penambahbaikan'),
  ('7.8 – 7.9', 'Tidak memuaskan: satu key match incident'),
  ('7.5 – 7.7', 'Tidak memuaskan: dua key match incident'),
  ('7.0 – 7.4', 'Buruk: tiga atau lebih key match incident / mempengaruhi keputusan'),
];

class _Section {
  _Section(this.key, this.label, this.items);
  final String key;
  final String label;
  final List<String> items;
}

class _Official {
  _Official(Map<String, dynamic> o, Map<String, dynamic>? saved)
      : lantikanId = o['lantikan_id'] ?? o['lantikan_pengadil_id'],
        jawatan = text(o['jawatan']),
        nama = text(o['nama_pengadil']),
        sections = [
          for (final s in (o['sections'] as List? ?? []))
            _Section('${(s as Map)['key']}', text(s['label']), [for (final i in (s['items'] as List? ?? [])) '$i']),
        ] {
    markah.text = saved?['markah'] == null ? '' : '${saved!['markah']}';
    prestasi = text(saved?['prestasi'], '');
    for (final s in sections) {
      kekuatan[s.key] = _list(saved?['${s.key}_kekuatan']);
      kelemahan[s.key] = _list(saved?['${s.key}_kelemahan']);
      nasihat[s.key] = TextEditingController(text: text(saved?['${s.key}_nasihat'], ''));
    }
  }

  final Object? lantikanId;
  final String jawatan;
  final String nama;
  final List<_Section> sections;
  final markah = TextEditingController();
  String prestasi = '';
  final Map<String, Set<String>> kekuatan = {};
  final Map<String, Set<String>> kelemahan = {};
  final Map<String, TextEditingController> nasihat = {};

  static Set<String> _list(Object? raw) => raw is List ? {for (final i in raw) '$i'} : <String>{};

  String get short => switch (jawatan) {
        'Pengadil' => 'R',
        'Penolong Pengadil 1' => 'AR1',
        'Penolong Pengadil 2' => 'AR2',
        _ => jawatan.toLowerCase().contains('ke4') || jawatan.contains('Ke-4') ? '4th' : jawatan,
      };

  double? get mark => double.tryParse(markah.text.trim().replaceAll(',', '.'));

  Map<String, dynamic> toJson() => {
        'lantikan_pengadil_id': lantikanId,
        'jawatan': jawatan,
        'nama_pengadil': nama,
        'markah': mark,
        'prestasi': prestasi,
        // Every field the website sends; sections this role lacks stay empty.
        for (final key in ['kawalan', 'fizikal', 'kerjasama']) ...{
          '${key}_kekuatan': (kekuatan[key] ?? <String>{}).toList(),
          '${key}_kelemahan': (kelemahan[key] ?? <String>{}).toList(),
          '${key}_nasihat': nasihat[key]?.text.trim() ?? '',
        },
      };

  void dispose() {
    markah.dispose();
    for (final c in nasihat.values) {
      c.dispose();
    }
  }
}

/// RA match report, the same draft/submit flow as the website's assessment
/// form: POST /api/laporan-penilaian.php saves the draft, PUT action=hantar
/// submits it. One official at a time, with the criteria from the server.
class LaporanFormScreen extends StatefulWidget {
  const LaporanFormScreen({super.key, required this.assignment, this.report});
  final Map<String, dynamic> assignment;
  final Map<String, dynamic>? report;

  @override
  State<LaporanFormScreen> createState() => _LaporanFormScreenState();
}

class _LaporanFormScreenState extends State<LaporanFormScreen> {
  final _ulasan = TextEditingController();
  List<_Official>? _officials;
  String? _error;
  String _tahapKesukaran = 'Normal';
  String _cuacaValue = '';
  int _active = 0;
  bool _saving = false;
  Object? _reportId;

  Map<String, dynamic> get a => widget.assignment;

  @override
  void initState() {
    super.initState();
    final r = widget.report;
    _reportId = r?['id'];
    _tahapKesukaran = text(r?['tahap_kesukaran'], 'Normal');
    _cuacaValue = text(r?['cuaca'], '');
    _ulasan.text = text(r?['ulasan_keseluruhan'], '');
    _load();
  }

  Future<void> _load() async {
    try {
      final body = await Api.instance.get('/api/laporan-penilaian.php', {'officials': a['jadual_id']});
      final saved = [for (final p in (widget.report?['pegawai'] as List? ?? [])) Map<String, dynamic>.from(p as Map)];
      final officials = [
        for (final o in (body['data'] as List? ?? []))
          _Official(Map<String, dynamic>.from(o as Map),
              saved.where((p) => '${p['lantikan_pengadil_id']}' == '${o['lantikan_id'] ?? o['lantikan_pengadil_id']}').firstOrNull),
      ];
      if (mounted) setState(() => _officials = officials);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  void dispose() {
    _ulasan.dispose();
    for (final o in _officials ?? <_Official>[]) {
      o.dispose();
    }
    super.dispose();
  }

  Future<void> _save({required bool submit}) async {
    final officials = _officials!;
    if (submit) {
      for (var i = 0; i < officials.length; i++) {
        final m = officials[i].mark;
        if (m == null || m < 6 || m > 10) {
          setState(() => _active = i);
          showToast(context, 'Isi markah 6.0 – 10 untuk ${officials[i].nama} (${officials[i].jawatan}).', ToastType.warning);
          return;
        }
      }
      final ok = await confirmSheet(context,
          title: 'Hantar laporan?',
          message: 'Laporan akan dihantar untuk pengesahan dan tidak boleh diedit lagi.',
          confirmLabel: 'Hantar laporan');
      if (!ok) return;
    }
    setState(() => _saving = true);
    try {
      final saved = await Api.instance.post('/api/laporan-penilaian.php', {
        'jadual_id': a['jadual_id'],
        'lantikan_id': a['id'],
        'tahap_kesukaran': _tahapKesukaran,
        'cuaca': _cuacaValue,
        'ulasan_keseluruhan': _ulasan.text.trim(),
        'pegawai': [for (final o in officials) o.toJson()],
      });
      _reportId = saved['id'] ?? _reportId;
      if (!submit) {
        if (mounted) showToast(context, text(saved['message'], 'Draf laporan disimpan.'));
        return;
      }
      final sent = await Api.instance.put('/api/laporan-penilaian.php', {'action': 'hantar', 'id': _reportId});
      if (mounted) Navigator.pop(context, text(sent['message'], 'Laporan berjaya dihantar.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pick(String title, List<String> items, Set<String> selected) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => SizedBox(
          height: MediaQuery.of(context).size.height * 0.85,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 8, 8),
              child: Row(children: [
                Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Siap')),
              ]),
            ),
            Expanded(
              child: ListView(children: [
                for (final item in items)
                  CheckboxListTile(
                    value: selected.contains(item),
                    activeColor: AppColors.black,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(item, style: const TextStyle(fontSize: 14)),
                    onChanged: (on) => setSheet(() => on == true ? selected.add(item) : selected.remove(item)),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final officials = _officials;
    return Scaffold(
      appBar: AppBar(title: const Text('Laporan penilaian', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      bottomNavigationBar: officials == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => _save(submit: false),
                      child: const Text('Simpan draf'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : () => _save(submit: true),
                      child: _saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                          : const Text('Hantar'),
                    ),
                  ),
                ]),
              ),
            ),
      body: _error != null
          ? EmptyState(icon: Icons.cloud_off_rounded, title: 'Tidak dapat dimuatkan', subtitle: _error)
          : officials == null
              ? const Loading()
              : ListView(padding: const EdgeInsets.all(16), children: [
                  AppCard(
                    color: AppColors.black,
                    child: Row(children: [
                      DateBlock(a['tarikh'], highlight: true),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(a['nama_kejohanan']), maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: Colors.white70)),
                          Text('${text(a['pasukan_home'])} vs ${text(a['pasukan_away'])}',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                          Text('${formatTime(a['masa'])} · ${text(a['tempat'])}', maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, color: Colors.white70)),
                        ]),
                      ),
                    ]),
                  ),
                  const SectionTitle('Perlawanan'),
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const Text('Tahap kesukaran', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
                      FilterChips<String>(
                        options: [for (final (v, _) in _tahap) (v, v)],
                        value: _tahapKesukaran,
                        onChanged: (v) => setState(() => _tahapKesukaran = v),
                      ),
                      Text(_tahap.firstWhere((t) => t.$1 == _tahapKesukaran, orElse: () => _tahap.first).$2,
                          style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                      const SizedBox(height: 14),
                      const Text('Cuaca', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
                      FilterChips<String>(
                        options: [('', 'Tiada'), for (final c in _cuaca) (c, c)],
                        value: _cuacaValue,
                        onChanged: (v) => setState(() => _cuacaValue = v),
                      ),
                    ]),
                  ),
                  if (officials.isEmpty)
                    const EmptyState(icon: Icons.groups_outlined, title: 'Tiada pegawai diterima untuk perlawanan ini')
                  else ...[
                    const SectionTitle('Pegawai'),
                    FilterChips<int>(
                      options: [
                        for (var i = 0; i < officials.length; i++)
                          (i, '${officials[i].short}${officials[i].mark != null ? ' ✓' : ''}'),
                      ],
                      value: _active,
                      onChanged: (v) => setState(() => _active = v),
                    ),
                    const SizedBox(height: 8),
                    _officialForm(officials[_active.clamp(0, officials.length - 1)]),
                  ],
                  const SectionTitle('Ulasan keseluruhan'),
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: TextField(
                      controller: _ulasan,
                      maxLines: 5,
                      decoration: const InputDecoration(
                          hintText: 'Ulasan dan rumusan prestasi pasukan pengadil dalam perlawanan ini...'),
                    ),
                  ),
                ]),
    );
  }

  Widget _officialForm(_Official o) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppCard(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: o.nama, radius: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(o.nama, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text(o.jawatan, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 110,
              child: TextField(
                key: ValueKey('markah-${o.lantikanId}'),
                controller: o.markah,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                decoration: const InputDecoration(labelText: 'Markah', hintText: '8.3'),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Wrap(spacing: 6, runSpacing: 6, children: [
                for (final p in _prestasi)
                  ChoiceChip(
                    label: Text(p),
                    selected: o.prestasi == p,
                    showCheckmark: false,
                    labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                        color: o.prestasi == p ? Tw.pahangYellow : AppColors.text),
                    onSelected: (_) => setState(() => o.prestasi = o.prestasi == p ? '' : p),
                  ),
              ]),
            ),
          ]),
          TextButton.icon(
            onPressed: () => showAppSheet<void>(context, title: 'Panduan skala pemarkahan', builder: (_) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [for (final (r, d) in _skala) DetailRow(Icons.straighten_rounded, r, d)],
            )),
            icon: const Icon(Icons.help_outline_rounded, size: 18),
            label: const Text('Panduan skala pemarkahan'),
          ),
        ]),
      ),
      for (final s in o.sections)
        AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(s.label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            _criteriaTile(Icons.thumb_up_alt_outlined, 'Kekuatan', Tw.emerald600, s, o.kekuatan[s.key]!),
            _criteriaTile(Icons.trending_down_rounded, 'Kelemahan', Tw.rose600, s, o.kelemahan[s.key]!),
            const SizedBox(height: 8),
            TextField(
              key: ValueKey('nasihat-${o.lantikanId}-${s.key}'),
              controller: o.nasihat[s.key],
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Nasihat', alignLabelWithHint: true),
            ),
          ]),
        ),
    ]);
  }

  Widget _criteriaTile(IconData icon, String label, Color color, _Section s, Set<String> selected) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: color),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(selected.isEmpty ? 'Pilih kriteria' : '${selected.length} dipilih',
            style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => _pick('$label · ${s.label}', s.items, selected),
      ),
      for (final item in selected)
        Padding(
          padding: const EdgeInsets.only(left: 40, bottom: 4),
          child: Text('• $item', style: const TextStyle(fontSize: 12, color: Tw.slate600)),
        ),
    ]);
  }
}

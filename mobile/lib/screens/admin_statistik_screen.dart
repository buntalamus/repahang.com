import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

/// Single-series bar colour (validated in the dataviz checks with the
/// statistics chart pair).
const _barColor = Color(0xFF7A5A00);

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

Map<String, dynamic> _map(Object? value) => Map<String, dynamic>.from(value as Map? ?? {});

int _int(Object? value) => int.tryParse('${value ?? ''}') ?? (value is num ? value.toInt() : 0);

/// Admin statistics (/api/statistics.php and /api/mobile-usage.php), the
/// website's /admin/statistik tabs as one scrolling page per section.
class AdminStatistikScreen extends StatefulWidget {
  const AdminStatistikScreen({super.key});

  @override
  State<AdminStatistikScreen> createState() => _AdminStatistikScreenState();
}

class _AdminStatistikScreenState extends State<AdminStatistikScreen> {
  int _year = DateTime.now().year;
  String _tab = 'permohonan';
  String _category = 'pengadil_berdaftar';
  String _query = '';

  static const _tabs = [
    ('permohonan', 'Permohonan'),
    ('pengadil', 'Pengadil'),
    ('lantikan', 'Lantikan'),
    ('perlawanan', 'Perlawanan'),
    ('penilaian', 'Penilaian'),
    ('peperiksaan', 'Peperiksaan'),
    ('kelayakan', 'Kelayakan'),
    ('app', 'App Mobile'),
  ];

  @override
  Widget build(BuildContext context) {
    final thisYear = DateTime.now().year;
    return Scaffold(
      appBar: AppBar(title: const Text('Statistik & Analitik')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: FilterChips<int>(
            options: [for (var y = thisYear + 2; y >= thisYear - 2; y--) (y, '$y')],
            value: _year,
            onChanged: (y) => setState(() => _year = y),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: FilterChips<String>(options: _tabs, value: _tab, onChanged: (v) => setState(() => _tab = v)),
        ),
        Expanded(
          child: _tab == 'app'
              ? AsyncView<Map<String, dynamic>>(
                  key: const ValueKey('app'),
                  load: () => Api.instance.get('/api/mobile-usage.php'),
                  builder: (context, d, reload) => RefreshList(onRefresh: reload, children: _appUsage(d)),
                )
              : AsyncView<Map<String, dynamic>>(
                  key: ValueKey(_year),
                  load: () async => _map((await Api.instance.get('/api/statistics.php', {'year': _year}))['data']),
                  builder: (context, d, reload) => RefreshList(onRefresh: reload, children: [
                    ..._summary(d),
                    ...switch (_tab) {
                      'pengadil' => _referees(d),
                      'lantikan' => _appointments(d),
                      'perlawanan' => _matches(d),
                      'penilaian' => _ratings(d),
                      'peperiksaan' => _exams(d),
                      'kelayakan' => _eligibility(d),
                      _ => _applications(d),
                    },
                  ]),
                ),
        ),
      ]),
    );
  }

  List<Widget> _summary(Map<String, dynamic> d) {
    final telegram = _map(d['telegram']);
    final lantikan = _map(d['lantikan']);
    final matches = _map(d['matches']);
    final ratings = _map(d['ratings']);
    return [
      TileGrid(
        columns: 3,
        runSpacing: 8,
        children: [
          MiniStat(label: 'Pengadil berdaftar', value: d['total']),
          MiniStat(label: 'Lantikan', value: lantikan['total'], color: AppColors.black),
          MiniStat(label: 'Perlawanan', value: matches['uniqueMatches'], color: AppColors.grey200),
          MiniStat(label: 'Purata markah', value: ratings['average'] ?? '-', color: AppColors.grey200),
          MiniStat(label: 'Penilaian', value: ratings['total'], color: AppColors.grey200),
          MiniStat(label: 'Telegram dipaut', value: '${_int(telegram['linked'])}/${_int(telegram['total'])}',
              color: AppColors.grey200),
        ],
      ),
    ];
  }

  List<Widget> _applications(Map<String, dynamic> d) {
    final apps = _map(d['applications']);
    final byType = _map(apps['byType']);
    final keys = byType.keys.toList();
    if (keys.isEmpty) return const [EmptyState(icon: Icons.description_outlined, title: 'Tiada data permohonan')];
    final cat = keys.contains(_category) ? _category : keys.first;
    final c = _map(byType[cat]);
    final reg = _map(d['annualRegistration']);
    final fitness = _map(reg['fitness']);
    final seminar = _map(reg['seminar']);
    return [
      const SectionTitle('Permohonan'),
      FilterChips<String>(
        options: [for (final k in keys) (k, formLabel(k))],
        value: cat,
        onChanged: (v) => setState(() => _category = v),
      ),
      const SizedBox(height: 8),
      _boxes([('Jumlah', c['total']), ('Menunggu', c['pending']), ('Diluluskan', c['approved']), ('Ditolak', c['rejected'])]),
      if (cat == 'pengadil_berdaftar') ...[
        const SectionTitle('Ujian Kecergasan'),
        _boxes([('Lulus', fitness['lulus']), ('Tidak lulus', fitness['tidak_lulus']), ('Tidak hadir', fitness['tidak_hadir']),
            ('Belum', fitness['belum'])]),
        const SectionTitle('Seminar'),
        _boxes([('Hadir', seminar['hadir']), ('Tidak hadir', seminar['tidak_hadir']), ('Belum', seminar['belum']),
            ('Layak patch', reg['patch_eligible'])]),
      ],
      SectionTitle('Trend bulanan · ${formLabel(cat)}'),
      AppCard(child: _MonthlyBars(values: _map(c['monthlyTrend']))),
      const SectionTitle('Pecahan ikut daerah'),
      _table(['Daerah', 'Mohon', 'Lulus', 'Tolak', 'Tunggu'], [
        for (final r in _rows(c['byDistrict']))
          [text(r['daerah']), '${_int(r['total'])}', '${_int(r['approved'])}', '${_int(r['rejected'])}', '${_int(r['pending'])}'],
      ]),
    ];
  }

  List<Widget> _referees(Map<String, dynamic> d) {
    final gender = _map(d['genderBreakdown']);
    return [
      const SectionTitle('Jantina'),
      _boxes([('Lelaki', gender['Lelaki']), ('Perempuan', gender['Perempuan'])]),
      const SectionTitle('Status pekerjaan'),
      _bars(_map(d['employmentBreakdown'])),
      const SectionTitle('Pengagihan daerah'),
      _bars(_map(d['districtAddressBreakdown'])),
      const SectionTitle('Trend pendaftaran bulanan'),
      AppCard(child: _MonthlyBars(values: _map(d['monthlyTrend']))),
    ];
  }

  List<Widget> _appointments(Map<String, dynamic> d) {
    final l = _map(d['lantikan']);
    return [
      const SectionTitle('Lantikan'),
      _boxes([('Jumlah', l['total']), ('Diterima', l['diterima']), ('Ditolak', l['ditolak']), ('Belum jawab', l['belum'])]),
      const SectionTitle('Mengikut daerah'),
      _table(['Daerah', 'Jumlah', 'Terima', 'Tolak', 'Belum'], [
        for (final r in _rows(d['lantikanDaerah']))
          [text(r['daerah']), '${_int(r['total'])}', '${_int(r['diterima'])}', '${_int(r['ditolak'])}', '${_int(r['belum'])}'],
      ]),
      const SectionTitle('Senarai kejohanan'),
      for (final k in _rows(d['kejohanan']))
        AppCard(
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(k['nama']), style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('${text(k['anjuran'])} · ${_int(k['jum_perlawanan'])} perlawanan',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
              ]),
            ),
            Pill(text(k['status']), tournamentTone('')),
          ]),
        ),
    ];
  }

  List<Widget> _matches(Map<String, dynamic> d) {
    final m = _map(d['matches']);
    return [
      const SectionTitle('Perlawanan'),
      _boxes([('Perlawanan', m['uniqueMatches']), ('Rekod', m['total']), ('Rekod pengadil', m['pengadilTotal']),
          ('Pengadil aktif', m['pengadilUniqueCount'])]),
      const SectionTitle('Top 10 pengadil paling aktif'),
      _bars({for (final r in _rows(m['topPengadil'])) text(r['name']): _int(r['count'])}),
      const SectionTitle('Mengikut daerah'),
      _table(['Daerah', 'Perlawanan', 'Disahkan'], [
        for (final r in _rows(d['perlawananDaerah'])) [text(r['daerah']), '${_int(r['total'])}', '${_int(r['disahkan'])}'],
      ]),
    ];
  }

  List<Widget> _ratings(Map<String, dynamic> d) {
    final r = _map(d['ratings']);
    String level(num avg) => avg >= 8 ? 'Cemerlang' : avg >= 6 ? 'Baik' : avg >= 4 ? 'Sederhana' : 'Lemah';
    return [
      const SectionTitle('Penilaian & merit'),
      _boxes([('Purata', r['average'] ?? '-'), ('Penilaian', r['total']), ('Pengadil dinilai', _rows(r['rankings']).length)]),
      const SectionTitle('Taburan markah'),
      _bars({for (final k in const ['1-3', '4-5', '6-7', '8-9', '10']) k: _map(r['distribution'])[k] ?? 0}, sort: false),
      const SectionTitle('Kedudukan merit'),
      _table(['#', 'Nama', 'Purata', 'Tahap'], [
        for (final (i, x) in _rows(r['rankings']).indexed)
          ['${i + 1}', text(x['nama']), text(x['avg']), level(num.tryParse('${x['avg']}') ?? 0)],
      ]),
    ];
  }

  List<Widget> _exams(Map<String, dynamic> d) {
    final e = _map(d['exams']);
    const labels = {'ujian_kecergasan': 'Ujian Kecergasan', 'ujian_bertulis': 'Ujian Kelas III FAM',
        'ujian_kelas1_fam': 'Ujian Kelas I FAM'};
    return [
      for (final MapEntry(key: key, value: label) in labels.entries) ...[
        SectionTitle(label),
        Builder(builder: (_) {
          final x = _map(e[key]);
          final sat = _int(x['lulus']) + _int(x['tidak_lulus']);
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _boxes([('Lulus', x['lulus']), ('Tidak lulus', x['tidak_lulus']), ('Tidak hadir', x['tidak_hadir']),
                ('Belum', x['belum_diproses'])]),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
              child: Text('Kadar lulus: ${sat == 0 ? '-' : '${(_int(x['lulus']) * 100 / sat).round()}%'}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
            ),
          ]);
        }),
      ],
    ];
  }

  List<Widget> _eligibility(Map<String, dynamic> d) {
    final k = _map(d['kelayakan']);
    final rules = _map(k['rules']);
    final q = _query.toLowerCase();
    List<Map<String, dynamic>> filter(Object? list) =>
        _rows(list).where((r) => q.isEmpty || '${r['nama']} ${r['daerah']}'.toLowerCase().contains(q)).toList();
    Widget group(String title, String rule, List<Map<String, dynamic>> rows, String Function(Map<String, dynamic>) extra) =>
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionTitle('$title (${rows.length})'),
          Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(rule, style: const TextStyle(fontSize: 12.5, color: AppColors.muted))),
          if (rows.isEmpty) const AppCard(child: Text('Tiada calon.', style: TextStyle(color: AppColors.muted))),
          if (rows.isNotEmpty)
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (final (i, r) in rows.take(50).indexed) ...[
                  if (i > 0) const Divider(indent: 16),
                  ListTile(
                    dense: true,
                    title: Text(text(r['nama']), style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${text(r['daerah'])} · ${extra(r)}', style: const TextStyle(fontSize: 12)),
                    trailing: Pill(r['permohonan'] == null ? 'Belum memohon' : text(r['permohonan']),
                        r['permohonan'] == null ? (AppColors.grey100, Tw.gray600) : (Tw.emerald50, Tw.emerald700)),
                  ),
                ],
              ]),
            ),
        ]);
    return [
      const SizedBox(height: 8),
      TextField(
        decoration: const InputDecoration(hintText: 'Cari nama atau daerah', prefixIcon: Icon(Icons.search_rounded)),
        onChanged: (v) => setState(() => _query = v.trim()),
      ),
      group('Layak Pendaftaran Tahunan', 'Sekurang-kurangnya ${text(rules['min_matches'])} perlawanan disahkan pada ${text(rules['match_year'])}.',
          filter(k['berdaftar']), (r) => '${_int(r['perlawanan'])} perlawanan'),
      group('Layak Kelas III FAM', 'Umur ${text(rules['kelas3_min_age'])}–${text(rules['kelas3_max_age'])} tahun.',
          filter(k['kelas3']), (r) => 'Umur ${text(r['umur'])}'),
      group('Layak Kelas I FAM', 'Umur tidak melebihi ${text(rules['kelas1_max_age'])} tahun dan lulus Kelas III.',
          filter(k['kelas1']), (r) => 'Lulus Kelas III ${text(r['tahun_lulus_kelas3'])}'),
    ];
  }

  List<Widget> _appUsage(Map<String, dynamic> d) {
    final summary = _rows(d['summary']);
    int sum(String key) => summary.fold(0, (a, r) => a + _int(r[key]));
    final users = _rows(d['users']);
    final q = _query.toLowerCase();
    final shown = users.where((u) => q.isEmpty || '${u['nama_penuh']} ${u['email']} ${u['persatuan']}'.toLowerCase().contains(q)).toList();
    const statusLabel = {'notifikasi': 'Notifikasi aktif', 'log_masuk': 'Log masuk sahaja', 'belum': 'Belum guna'};
    return [
      const SectionTitle('Penggunaan App Mobile'),
      _boxes([('Guna app', '${sum('notifikasi') + sum('log_masuk')}/${sum('aktif')}'), ('Notifikasi', sum('notifikasi')),
          ('Log masuk', sum('log_masuk')), ('Belum', sum('belum'))]),
      Padding(padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
          child: Text('Versi Android terkini: ${text(d['latest_version'])}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted))),
      const SectionTitle('Mengikut peranan'),
      _table(['Peranan', 'Aktif', 'Notif', 'Log masuk', 'Belum'], [
        for (final r in summary)
          [text(r['role']), '${_int(r['aktif'])}', '${_int(r['notifikasi'])}', '${_int(r['log_masuk'])}', '${_int(r['belum'])}'],
      ]),
      const SectionTitle('Pengguna'),
      TextField(
        decoration: const InputDecoration(hintText: 'Cari nama, emel atau persatuan', prefixIcon: Icon(Icons.search_rounded)),
        onChanged: (v) => setState(() => _query = v.trim()),
      ),
      const SizedBox(height: 8),
      AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (final (i, u) in shown.take(100).indexed) ...[
            if (i > 0) const Divider(indent: 16),
            ListTile(
              dense: true,
              title: Text(text(u['nama_penuh']), style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${text(u['role'])} · ${text(u['persatuan'])}${text(u['android_version'], '').isEmpty ? '' : ' · v${u['android_version']}'}',
                  style: const TextStyle(fontSize: 12)),
              trailing: Pill(statusLabel[u['status']] ?? text(u['status']),
                  u['status'] == 'notifikasi' ? (Tw.emerald50, Tw.emerald700) : u['status'] == 'log_masuk'
                      ? (Tw.amber50, Tw.amber700) : (AppColors.grey100, Tw.gray600)),
            ),
          ],
        ]),
      ),
    ];
  }

  Widget _boxes(List<(String, Object?)> items) => Row(children: [
        for (final (i, (label, value)) in items.indexed) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: MiniStat(label: label, value: value ?? 0, color: i == 0 ? AppColors.yellow : AppColors.grey200)),
        ],
      ]);

  Widget _bars(Map<String, dynamic> data, {bool sort = true}) {
    final entries = data.entries.map((e) => (e.key, _int(e.value))).toList();
    if (sort) entries.sort((a, b) => b.$2.compareTo(a.$2));
    if (entries.isEmpty) return const AppCard(child: Text('Tiada data.', style: TextStyle(color: AppColors.muted)));
    final max = entries.map((e) => e.$2).fold(0, (a, b) => a > b ? a : b);
    return AppCard(
      child: Column(children: [
        for (final (label, value) in entries.take(15))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              SizedBox(width: 130, child: Text(label.isEmpty ? '-' : label, maxLines: 2, style: const TextStyle(fontSize: 12.5))),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(value: max == 0 ? 0 : value / max, minHeight: 10,
                      backgroundColor: AppColors.grey100, color: _barColor),
                ),
              ),
              SizedBox(width: 40, child: Text('$value', textAlign: TextAlign.right,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
            ]),
          ),
      ]),
    );
  }

  Widget _table(List<String> head, List<List<String>> rows) {
    if (rows.isEmpty) return const AppCard(child: Text('Tiada data.', style: TextStyle(color: AppColors.muted)));
    const h = TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.muted);
    return AppCard(
      child: Table(
        columnWidths: {0: const FlexColumnWidth(2.4), for (var i = 1; i < head.length; i++) i: const FlexColumnWidth()},
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        children: [
          TableRow(children: [
            for (final (i, x) in head.indexed) Text(x, style: h, textAlign: i == 0 ? TextAlign.left : TextAlign.right),
          ]),
          for (final r in rows)
            TableRow(children: [
              for (final (i, x) in r.indexed)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Text(x, textAlign: i == 0 ? TextAlign.left : TextAlign.right,
                      style: TextStyle(fontSize: 12.5, fontWeight: i == 0 ? FontWeight.w600 : FontWeight.w400)),
                ),
            ]),
        ],
      ),
    );
  }
}

/// One-series monthly bars ("1".."12" → count), with a touch tooltip.
class _MonthlyBars extends StatelessWidget {
  const _MonthlyBars({required this.values});
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) {
    final counts = [for (var m = 1; m <= 12; m++) _int(values['$m'])];
    final peak = counts.fold(0, (a, b) => a > b ? a : b);
    final top = peak <= 4 ? 4.0 : (peak / 4).ceil() * 4.0;
    return SizedBox(
      height: 170,
      child: BarChart(BarChartData(
        maxY: top,
        minY: 0,
        borderData: FlBorderData(show: false),
        gridData: FlGridData(drawVerticalLine: false, horizontalInterval: top / 4,
            getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.line, strokeWidth: 1)),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, interval: top / 4,
              getTitlesWidget: (v, _) => Text('${v.toInt()}', style: const TextStyle(fontSize: 10, color: AppColors.muted)))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 22,
              getTitlesWidget: (v, _) => Padding(padding: const EdgeInsets.only(top: 6),
                  child: Text(monthShort(v.toInt() + 1), style: const TextStyle(fontSize: 9.5, color: AppColors.muted))))),
        ),
        barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(
          getTooltipColor: (_) => AppColors.black,
          getTooltipItem: (group, _, rod, _) => BarTooltipItem('${monthShort(group.x + 1)}: ${rod.toY.toInt()}',
              const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        )),
        barGroups: [
          for (var i = 0; i < 12; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(toY: counts[i].toDouble(), color: _barColor, width: 12,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4))),
            ]),
        ],
      )),
    );
  }
}

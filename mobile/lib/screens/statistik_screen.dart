import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

/// Chart colours, validated with the dataviz palette checks (light surface):
/// all records vs the verified part of them.
const _totalColor = Color(0xFFD9AE1A);
const _verifiedColor = Color(0xFF7A5A00);

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

int _int(Object? value) => int.tryParse('${value ?? ''}') ?? 0;

/// Yearly statistics for Pengadil, Penilai and PP Daerah from
/// /api/portal-dashboard.php, like the website's /statistik pages.
class StatistikScreen extends StatefulWidget {
  const StatistikScreen({super.key});

  @override
  State<StatistikScreen> createState() => _StatistikScreenState();
}

class _StatistikScreenState extends State<StatistikScreen> {
  int _year = DateTime.now().year;

  SessionUser get _user => Api.instance.user.value!;

  String get _view => switch (_user.role) {
        'PP Daerah' => 'pp',
        'Penilai' => 'ra',
        _ => 'pengadil',
      };

  /// (records, verified) labels for the chart's two series.
  (String, String) get _series => switch (_view) {
        'ra' => ('Laporan', 'Disahkan'),
        'pp' => ('Perlawanan', 'Disahkan'),
        _ => ('Rekod', 'Disahkan'),
      };

  @override
  Widget build(BuildContext context) {
    final thisYear = DateTime.now().year;
    return Scaffold(
      appBar: AppBar(title: Text(_view == 'pp' ? 'Statistik Daerah' : 'Statistik Saya')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: FilterChips<int>(
            options: [for (var y = thisYear; y >= thisYear - 3; y--) (y, '$y')],
            value: _year,
            onChanged: (y) => setState(() => _year = y),
          ),
        ),
        Expanded(
          child: AsyncView<Map<String, dynamic>>(
            key: ValueKey(_year),
            load: () async => Map<String, dynamic>.from(
                (await Api.instance.get('/api/portal-dashboard.php', {'view': _view, 'year': _year}))['data'] as Map),
            builder: (context, d, reload) => RefreshList(onRefresh: reload, children: _content(d)),
          ),
        ),
      ]),
    );
  }

  List<Widget> _content(Map<String, dynamic> d) {
    final t = Map<String, dynamic>.from(d['totals'] as Map? ?? {});
    final monthly = _rows(d['monthly']);
    final tiles = switch (_view) {
      'pp' => [('Berdaftar', t['registered']), ('Berlesen', t['licensed']), ('Rekod', t['records']), ('Disahkan', t['verified'])],
      'ra' => [('Diterima', t['accepted']), ('Dihantar', t['submitted']), ('Disahkan', t['confirmed']), ('Draf', t['drafts'])],
      _ => [('Rekod', t['records']), ('Disahkan', t['verified']), ('Menunggu', t['pending']), ('Ditolak', t['rejected'])],
    };
    final minimum = _int(d['minimum_matches']);
    final positions = _rows(d['positions']);
    final ranking = _rows(d['ranking']);
    final applications = Map<String, dynamic>.from(d['applications'] as Map? ?? {});
    final registrations = _rows(d['registrations']);
    return [
      Row(children: [
        for (final (i, (label, value)) in tiles.indexed) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: MiniStat(label: label, value: value ?? 0, color: i == 0 ? AppColors.yellow : AppColors.grey200)),
        ],
      ]),
      if (_view == 'pengadil' && minimum > 0) ...[
        const SizedBox(height: 12),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Perlawanan disahkan ${_int(t['verified'])} / $minimum',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (_int(t['verified']) / minimum).clamp(0, 1).toDouble(),
                minHeight: 8,
                backgroundColor: AppColors.grey100,
                color: _int(t['verified']) >= minimum ? Tw.emerald500 : Tw.pahangYellow,
              ),
            ),
          ]),
        ),
      ],
      SectionTitle('Bulanan $_year'),
      AppCard(child: _MonthlyChart(monthly: monthly, series: _series)),
      _MonthlyTable(monthly: monthly, series: _series),
      if (positions.isNotEmpty) ...[
        const SectionTitle('Mengikut jawatan'),
        AppCard(
          child: Column(children: [
            for (final p in positions) _barRow(text(p['label']), _int(p['total']),
                positions.map((e) => _int(e['total'])).reduce((a, b) => a > b ? a : b)),
          ]),
        ),
      ],
      if (ranking.isNotEmpty) ...[
        const SectionTitle('Pegawai paling aktif'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final (i, r) in ranking.indexed) ...[
              if (i > 0) const Divider(indent: 56),
              ListTile(
                leading: CircleAvatar(radius: 14, backgroundColor: i == 0 ? Tw.pahangYellow : AppColors.grey100,
                    foregroundColor: AppColors.black,
                    child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800))),
                title: Text(text(r['name']), maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                trailing: Text('${_int(r['verified'])} disahkan',
                    style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ),
            ],
          ]),
        ),
      ],
      if (applications.isNotEmpty) ...[
        const SectionTitle('Permohonan'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final (i, e) in applications.entries.indexed) ...[
              if (i > 0) const Divider(indent: 16),
              ListTile(
                title: Text(formLabel(e.key), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                trailing: Text(e.value is Map ? '${(e.value as Map)['total'] ?? '-'}' : '${e.value}',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ],
          ]),
        ),
      ],
      if (registrations.isNotEmpty) ...[
        const SectionTitle('Permohonan saya'),
        for (final r in registrations)
          AppCard(
            child: Row(children: [
              Expanded(child: Text(formLabel(r['jenis_borang']), style: const TextStyle(fontWeight: FontWeight.w600))),
              Pill(text(r['status_workflow'] ?? r['status']), applicationTone(text(r['status_workflow'] ?? r['status']))),
            ]),
          ),
      ],
      if (text(d['unit_note'], '').isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
          child: Text(text(d['unit_note']), style: const TextStyle(fontSize: 12, color: AppColors.muted, height: 1.5)),
        ),
    ];
  }

  Widget _barRow(String label, int value, int max) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          SizedBox(width: 140, child: Text(label, maxLines: 2, style: const TextStyle(fontSize: 12.5))),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: max == 0 ? 0 : value / max, minHeight: 10,
                  backgroundColor: AppColors.grey100, color: _verifiedColor),
            ),
          ),
          SizedBox(width: 36, child: Text('$value', textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
        ]),
      );
}

/// Grouped monthly bars: all records and the verified ones, one y-axis.
class _MonthlyChart extends StatelessWidget {
  const _MonthlyChart({required this.monthly, required this.series});
  final List<Map<String, dynamic>> monthly;
  final (String, String) series;

  @override
  Widget build(BuildContext context) {
    final peak = monthly.fold<int>(0, (m, r) => _int(r['total']) > m ? _int(r['total']) : m);
    final top = peak <= 4 ? 4.0 : (peak / 4).ceil() * 4.0;
    Widget legend(Color color, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [legend(_totalColor, series.$1), const SizedBox(width: 16), legend(_verifiedColor, series.$2)]),
      const SizedBox(height: 16),
      SizedBox(
        height: 180,
        child: BarChart(BarChartData(
          maxY: top,
          minY: 0,
          alignment: BarChartAlignment.spaceAround,
          borderData: FlBorderData(show: false),
          gridData: FlGridData(
            drawVerticalLine: false,
            horizontalInterval: top / 4,
            getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.line, strokeWidth: 1),
          ),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: AxisTitles(sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: top / 4,
              getTitlesWidget: (v, meta) => Text('${v.toInt()}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
            )),
            bottomTitles: AxisTitles(sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              getTitlesWidget: (v, meta) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(monthShort(v.toInt() + 1), style: const TextStyle(fontSize: 9.5, color: AppColors.muted)),
              ),
            )),
          ),
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => AppColors.black,
              getTooltipItem: (group, _, rod, rodIndex) => BarTooltipItem(
                '${monthShort(group.x + 1)}\n${rodIndex == 0 ? series.$1 : series.$2}: ${rod.toY.toInt()}',
                const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          barGroups: [
            for (final (i, r) in monthly.indexed)
              BarChartGroupData(x: i, barsSpace: 2, barRods: [
                BarChartRodData(toY: _int(r['total']).toDouble(), color: _totalColor, width: 7,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4))),
                BarChartRodData(toY: _int(r['verified']).toDouble(), color: _verifiedColor, width: 7,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4))),
              ]),
          ],
        )),
      ),
    ]);
  }
}

/// The chart's numbers as a table, for exact values and colour-blind readers.
class _MonthlyTable extends StatefulWidget {
  const _MonthlyTable({required this.monthly, required this.series});
  final List<Map<String, dynamic>> monthly;
  final (String, String) series;

  @override
  State<_MonthlyTable> createState() => _MonthlyTableState();
}

class _MonthlyTableState extends State<_MonthlyTable> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    const head = TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.muted);
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        ListTile(
          dense: true,
          title: const Text('Jadual bulanan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          trailing: Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded),
          onTap: () => setState(() => _open = !_open),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Table(
              columnWidths: const {0: FlexColumnWidth(2), 1: FlexColumnWidth(), 2: FlexColumnWidth()},
              children: [
                TableRow(children: [
                  const Text('Bulan', style: head),
                  Text(widget.series.$1, style: head, textAlign: TextAlign.right),
                  Text(widget.series.$2, style: head, textAlign: TextAlign.right),
                ]),
                for (final r in widget.monthly)
                  TableRow(children: [
                    Padding(padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(monthShort(_int(r['month']).clamp(1, 12)), style: const TextStyle(fontSize: 13))),
                    Padding(padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text('${_int(r['total'])}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 13))),
                    Padding(padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text('${_int(r['verified'])}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 13))),
                  ]),
              ],
            ),
          ),
      ]),
    );
  }
}

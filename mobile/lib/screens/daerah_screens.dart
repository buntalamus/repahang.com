import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;
import 'rekod_screen.dart' show markahTone;

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

/// PP Daerah: the district's registered referees or assessors
/// (/api/pp-referees.php), like /pp-daerah/pengadil and /pp-daerah/ra-berdaftar.
class DaerahPegawaiScreen extends StatefulWidget {
  const DaerahPegawaiScreen({super.key, this.role = 'Pengadil'});

  /// 'Pengadil' or 'Penilai'.
  final String role;

  @override
  State<DaerahPegawaiScreen> createState() => _DaerahPegawaiScreenState();
}

class _DaerahPegawaiScreenState extends State<DaerahPegawaiScreen> {
  String _query = '';
  String _status = 'semua';

  bool get _assessors => widget.role == 'Penilai';

  void _open(Map<String, dynamic> r) {
    showAppSheet<void>(context, builder: (context) => AsyncView<Map<String, dynamic>>(
      load: () async {
        final body = await Api.instance.get('/api/pp-referees.php', {'role': widget.role, 'single': r['id']});
        return _rows(body['referees']).firstOrNull ?? r;
      },
      builder: (context, d, _) {
        final matches = _rows(d['perlawanan']);
        final active = '${d['aktif']}' == '1';
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: text(d['nama_penuh']), photo: d['url_gambar_profil'] as String?, radius: 28),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(d['nama_penuh']), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  Pill(text(d['jenis_pengadil']), (AppColors.yellowSoft, AppColors.black)),
                  Pill(active ? 'Aktif' : 'Tidak aktif',
                      active ? (Tw.emerald50, Tw.emerald700) : (AppColors.grey100, Tw.gray600)),
                ]),
              ]),
            ),
          ]),
          const SizedBox(height: 8),
          DetailRow(Icons.phone_outlined, 'No. telefon', text(d['no_telefon']),
              onTap: () => callNumber(context, text(d['no_telefon'], '')),
              trailing: const Icon(Icons.call_rounded, color: AppColors.muted, size: 20)),
          DetailRow(Icons.mail_outline, 'Emel', text(d['email'])),
          DetailRow(Icons.badge_outlined, 'No. KP', text(d['no_ic'])),
          DetailRow(Icons.description_outlined, 'Permohonan',
              '${text(d['total_permohonan'], '0')} dihantar · ${text(d['permohonan_lulus'], '0')} lulus'),
          if (!_assessors && matches.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('Rekod perlawanan (${matches.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            for (final m in matches.take(8))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${text(m['home_team'] ?? m['pasukan_home'])} vs ${text(m['away_team'] ?? m['pasukan_away'])}',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      Text('${formatDate(m['tarikh'])} · ${text(m['jawatan'])}',
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                    ]),
                  ),
                  Pill(text(m['status_pp'], 'Menunggu'), matchTone(text(m['status_pp'], ''))),
                ]),
              ),
          ],
        ]);
      },
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_assessors ? 'Penilai Berdaftar' : 'Pengadil Berdaftar'),
        actions: [
          IconButton(
            tooltip: 'Eksport (CSV)',
            onPressed: () => downloadAndOpen(context, '/api/pp-export-referees.php',
                query: {'type': _assessors ? 'penilai' : 'pengadil'}, fallbackName: 'senarai.csv'),
            icon: const Icon(Icons.file_download_outlined),
          ),
        ],
      ),
      body: AsyncView<Map<String, dynamic>>(
        load: () => Api.instance.get('/api/pp-referees.php', {'role': widget.role}),
        builder: (context, body, reload) {
          final stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
          final q = _query.toLowerCase();
          final all = _rows(body['referees']);
          final shown = all.where((r) {
            if (_status == 'aktif' && '${r['aktif']}' != '1') return false;
            if (_status == 'tidak' && '${r['aktif']}' == '1') return false;
            return q.isEmpty || '${r['nama_penuh']} ${r['no_ic']} ${r['no_telefon']}'.toLowerCase().contains(q);
          }).toList();
          return RefreshList(onRefresh: reload, children: [
            Row(children: [
              Expanded(child: MiniStat(label: 'Jumlah', value: stats['total'] ?? all.length)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Berlesen ${DateTime.now().year}', value: stats['active'], color: Tw.emerald500)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Belum', value: stats['inactive'], color: Tw.gray300)),
            ]),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Cari nama, No. KP atau telefon',
                  prefixIcon: Icon(Icons.search_rounded)),
              onChanged: (v) => setState(() => _query = v.trim()),
            ),
            const SizedBox(height: 8),
            FilterChips<String>(
              options: const [('semua', 'Semua'), ('aktif', 'Aktif'), ('tidak', 'Tidak aktif')],
              value: _status,
              onChanged: (v) => setState(() => _status = v),
            ),
            const SizedBox(height: 8),
            if (shown.isEmpty)
              const EmptyState(icon: Icons.group_off_outlined, title: 'Tiada rekod')
            else
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, r) in shown.indexed) ...[
                    if (i > 0) const Divider(indent: 72),
                    ListTile(
                      onTap: () => _open(r),
                      leading: Avatar(name: text(r['nama_penuh']), radius: 20),
                      title: Text(text(r['nama_penuh']), maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      subtitle: Text('${text(r['jenis_pengadil'])} · ${text(r['no_telefon'])}',
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      trailing: '${r['aktif']}' == '1'
                          ? null
                          : const Pill('Tidak aktif', (AppColors.grey100, Tw.gray600)),
                    ),
                  ],
                ]),
              ),
          ]);
        },
      ),
    );
  }
}

/// PP Daerah: confirmed assessment reports that name the district's officials
/// (/api/pp-penilaian.php), like /pp-daerah/laporan-penilaian.
class DaerahPenilaianScreen extends StatelessWidget {
  const DaerahPenilaianScreen({super.key});

  void _open(BuildContext context, Map<String, dynamic> report) {
    showAppSheet<void>(context, builder: (context) => AsyncView<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(
          (await Api.instance.get('/api/pp-penilaian.php', {'id': report['id']}))['laporan'] as Map),
      builder: (context, d, _) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('${text(d['pasukan_home'])} vs ${text(d['pasukan_away'])}',
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        Text('${text(d['nama_kejohanan'])} · ${formatDate(d['tarikh'])}', style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 8),
        DetailRow(Icons.person_outline, 'Penilai', text(d['nama_penilai'])),
        DetailRow(Icons.speed_rounded, 'Tahap kesukaran', text(d['tahap_kesukaran'])),
        DetailRow(Icons.scoreboard_outlined, 'Keputusan',
            'HT ${text(d['skor_ht_home'])}-${text(d['skor_ht_away'])} · FT ${text(d['skor_ft_home'])}-${text(d['skor_ft_away'])}'),
        const SizedBox(height: 8),
        for (final o in _rows(d['pegawai'])) _OfficialCard(official: o),
        if (text(d['ulasan_keseluruhan'], '').isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('Ulasan keseluruhan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(text(d['ulasan_keseluruhan']), style: const TextStyle(fontSize: 14, height: 1.5)),
        ],
      ]),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Laporan Penilaian')),
      body: AsyncView<List<Map<String, dynamic>>>(
        load: () async => _rows((await Api.instance.get('/api/pp-penilaian.php'))['data']),
        builder: (context, reports, reload) => RefreshList(onRefresh: reload, children: [
          if (reports.isEmpty)
            const EmptyState(icon: Icons.assessment_outlined, title: 'Tiada laporan disahkan',
                subtitle: 'Laporan penilaian yang disahkan bagi pegawai daerah anda akan dipaparkan di sini.'),
          for (final r in reports)
            AppCard(
              onTap: () => _open(context, r),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  DateBlock(r['tarikh']),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(text(r['nama_kejohanan']), maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
                      Text('${text(r['pasukan_home'])} vs ${text(r['pasukan_away'])}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                      Text('Penilai: ${text(r['nama_penilai'])}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                    ]),
                  ),
                ]),
                const SizedBox(height: 10),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final o in _rows(r['pegawai']))
                    Pill('${text(o['jawatan']).replaceAll('Penolong Pengadil ', 'AR')}: ${text(o['markah'])}',
                        markahTone(o['markah'])),
                ]),
              ]),
            ),
        ]),
      ),
    );
  }
}

class _OfficialCard extends StatelessWidget {
  const _OfficialCard({required this.official});
  final Map<String, dynamic> official;

  @override
  Widget build(BuildContext context) {
    final o = official;
    final tone = markahTone(o['markah']);
    return AppCard(
      color: AppColors.background,
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: tone.$1, shape: BoxShape.circle),
          child: Text(text(o['markah']), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: tone.$2)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(o['nama_pengadil']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            Text('${text(o['jawatan'])} · ${text(o['prestasi'])}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
          ]),
        ),
      ]),
    );
  }
}

/// PP Daerah: the district's applications by form (/api/pp-applications.php),
/// like /pp-daerah/permohonan/*. Verifying stays in Semakan.
class DaerahPermohonanScreen extends StatefulWidget {
  const DaerahPermohonanScreen({super.key});

  @override
  State<DaerahPermohonanScreen> createState() => _DaerahPermohonanScreenState();
}

class _DaerahPermohonanScreenState extends State<DaerahPermohonanScreen> {
  /// pp-applications.php `type` → (label, pp-export-referees.php `type`).
  static const _types = {
    'pengadil': ('Pengadil', 'pengadil'),
    'berdaftar': ('Penilai', 'penilai'),
    'kelas3': ('Kelas III', 'kelas3'),
    'kelas1': ('Kelas I', 'kelas1'),
  };
  String _type = 'pengadil';

  void _open(Map<String, dynamic> a) {
    final status = text(a['status_workflow'] ?? a['status']);
    final matches = _rows(a['perlawanan'] ?? a['matches']);
    showAppSheet<void>(context, builder: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Align(alignment: Alignment.centerLeft, child: Pill(status, applicationTone(status))),
      const SizedBox(height: 10),
      Text(text(a['nama_penuh']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      Text(formLabel(a['application_category'] ?? a['jenis_borang']), style: const TextStyle(color: AppColors.muted)),
      const SizedBox(height: 8),
      DetailRow(Icons.calendar_month_outlined, 'Sesi', text(a['tahun_permohonan'])),
      DetailRow(Icons.send_outlined, 'Tarikh hantar', text(a['tarikh_hantar'])),
      if (text(a['no_telefon'], '').isNotEmpty)
        DetailRow(Icons.phone_outlined, 'No. telefon', text(a['no_telefon']),
            onTap: () => callNumber(context, text(a['no_telefon'], ''))),
      if (text(a['pp_notes'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan PP Daerah', text(a['pp_notes'])),
      if (text(a['admin_notes'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan Admin', text(a['admin_notes'])),
      if (matches.isNotEmpty) DetailRow(Icons.sports_outlined, 'Perlawanan dipautkan', '${matches.length}'),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Permohonan Daerah'),
        actions: [
          IconButton(
            tooltip: 'Eksport (CSV)',
            onPressed: () => downloadAndOpen(context, '/api/pp-export-referees.php',
                query: {'type': _types[_type]!.$2}, fallbackName: 'permohonan.csv'),
            icon: const Icon(Icons.file_download_outlined),
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: FilterChips<String>(
            options: [for (final e in _types.entries) (e.key, e.value.$1)],
            value: _type,
            onChanged: (v) => setState(() => _type = v),
          ),
        ),
        Expanded(
          child: AsyncView<List<Map<String, dynamic>>>(
            key: ValueKey(_type),
            load: () async {
              final body = await Api.instance.get('/api/pp-applications.php', {'type': _type});
              return _rows(body['applications'] ?? body['data']);
            },
            builder: (context, items, reload) => RefreshList(onRefresh: reload, children: [
              if (items.isEmpty) const EmptyState(icon: Icons.description_outlined, title: 'Tiada permohonan'),
              for (final a in items)
                AppCard(
                  onTap: () => _open(a),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(text(a['nama_penuh']), maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        Text('Sesi ${text(a['tahun_permohonan'])} · ${text(a['tarikh_hantar'])}',
                            style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                        const SizedBox(height: 6),
                        Pill(text(a['status_workflow'] ?? a['status']),
                            applicationTone(text(a['status_workflow'] ?? a['status']))),
                      ]),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
                  ]),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

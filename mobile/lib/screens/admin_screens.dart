import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

int _int(Object? value) => int.tryParse('${value ?? ''}') ?? 0;

/// Admin: every match record with verify / reject / revert / delete
/// (/api/admin-matches.php), like /admin/perlawanan.
class AdminPerlawananScreen extends StatefulWidget {
  const AdminPerlawananScreen({super.key});

  @override
  State<AdminPerlawananScreen> createState() => _AdminPerlawananScreenState();
}

class _AdminPerlawananScreenState extends State<AdminPerlawananScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _status = 'pending';
  String _search = '';
  int _page = 1;

  Future<Map<String, dynamic>> _load() => Api.instance.get('/api/admin-matches.php', {
        'status': _status,
        if (_search.isNotEmpty) 'search': _search,
        'page': _page,
        'per_page': 25,
      });

  void _reload({bool resetPage = true}) {
    if (resetPage) _page = 1;
    _view.currentState?.reload();
  }

  Future<void> _open(Map<String, dynamic> m) async {
    final changed = await showAppSheet<bool>(context, builder: (_) => _MatchActions(match: m));
    if (changed == true) _reload(resetPage: false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rekod Perlawanan')),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        load: _load,
        builder: (context, body, reload) {
          final stats = Map<String, dynamic>.from(body['statistics'] as Map? ?? {});
          final matches = _rows(body['matches']);
          final pages = _int((body['pagination'] as Map?)?['total_pages']);
          Widget stat(String key, String label, Color color) => Expanded(
                child: MiniStat(label: label, value: stats[key] ?? 0, color: _status == key ? color : AppColors.grey200,
                    onTap: () => setState(() {
                          _status = key;
                          _reload();
                        })),
              );
          return RefreshList(onRefresh: reload, children: [
            Row(children: [
              stat('pending', 'Menunggu', AppColors.yellow),
              const SizedBox(width: 8),
              stat('verified', 'Disahkan', Tw.emerald500),
              const SizedBox(width: 8),
              stat('rejected', 'Ditolak', Tw.rose300),
            ]),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Cari pasukan, tempat, pengadil...', prefixIcon: Icon(Icons.search_rounded)),
              textInputAction: TextInputAction.search,
              onSubmitted: (v) {
                _search = v.trim();
                _reload();
              },
            ),
            const SizedBox(height: 12),
            if (matches.isEmpty) const EmptyState(icon: Icons.sports_soccer_outlined, title: 'Tiada rekod'),
            for (final m in matches)
              AppCard(
                onTap: () => _open(m),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  DateBlock(m['tarikh']),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${text(m['jenis'])} · ${text(m['daerah_perlawanan_nama'])}', maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
                      Text('${text(m['home_team'])} vs ${text(m['away_team'])}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                      Text('${_rows(m['officials']).length} pegawai · oleh ${text(m['submitter_name'])}',
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      const SizedBox(height: 6),
                      Pill(text(m['status_pp'], 'Belum Disahkan'), matchTone(text(m['status_pp'], ''))),
                    ]),
                  ),
                ]),
              ),
            if (pages > 1)
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                IconButton(
                  onPressed: _page <= 1 ? null : () => setState(() {
                    _page--;
                    _reload(resetPage: false);
                  }),
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Text('Halaman $_page / $pages'),
                IconButton(
                  onPressed: _page >= pages ? null : () => setState(() {
                    _page++;
                    _reload(resetPage: false);
                  }),
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ]),
          ]);
        },
      ),
    );
  }
}

class _MatchActions extends StatefulWidget {
  const _MatchActions({required this.match});
  final Map<String, dynamic> match;

  @override
  State<_MatchActions> createState() => _MatchActionsState();
}

class _MatchActionsState extends State<_MatchActions> {
  final _reason = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _target => {
        if (text(widget.match['match_group_id'], '').isNotEmpty)
          'match_group_id': '${widget.match['match_group_id']}'
        else
          'match_id': widget.match['id'],
      };

  /// [action] is verify / reject / revert, or null to delete.
  Future<void> _run(String? action) async {
    final reason = _reason.text.trim();
    if (action != 'revert' && reason.isEmpty) {
      showToast(context, 'Sila isi justifikasi.', ToastType.warning);
      return;
    }
    if (action == null) {
      final ok = await confirmSheet(context, title: 'Padam rekod?',
          message: 'Padam semua rekod perlawanan ini? Tidak boleh dibatalkan.', confirmLabel: 'Ya, Padam',
          color: Tw.rose600, textColor: Colors.white);
      if (!ok) return;
    }
    setState(() => _busy = true);
    try {
      final body = {..._target, 'justification': reason};
      final result = action == null
          ? await Api.instance.delete('/api/admin-matches.php', body)
          : await Api.instance.post('/api/admin-matches.php', {...body, 'action': action});
      if (!mounted) return;
      showToast(context, text(result['message'], 'Berjaya dikemaskini.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.match;
    final status = text(m['status_pp'], '');
    String score(String k) =>
        text(m['skor_${k}_home'], '').isEmpty ? '' : '${k.toUpperCase()} ${m['skor_${k}_home']}-${m['skor_${k}_away']}';
    final scores = ['ht', 'ft', 'et', 'ps'].map(score).where((s) => s.isNotEmpty).join(' · ');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Align(alignment: Alignment.centerLeft, child: Pill(status.isEmpty ? 'Belum Disahkan' : status, matchTone(status))),
      const SizedBox(height: 8),
      Text('${text(m['home_team'])} vs ${text(m['away_team'])}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      Text('${formatDayDate(m['tarikh'])} · ${formatTime(m['masa'])}', style: const TextStyle(color: AppColors.muted)),
      const SizedBox(height: 8),
      DetailRow(Icons.emoji_events_outlined, 'Kejohanan', '${text(m['nama_kejohanan'])} (${text(m['jenis'])})'),
      DetailRow(Icons.place_outlined, 'Tempat', '${text(m['tempat'])} · ${text(m['daerah_perlawanan_nama'])}'),
      if (scores.isNotEmpty) DetailRow(Icons.scoreboard_outlined, 'Keputusan', scores),
      DetailRow(Icons.person_outline, 'Dihantar oleh', text(m['submitter_name'])),
      if (text(m['catatan_pp'], '').isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan', text(m['catatan_pp'])),
      const SizedBox(height: 8),
      const Text('Pegawai', style: TextStyle(fontWeight: FontWeight.w700)),
      for (final o in _rows(m['officials']))
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text('${text(o['jawatan'])}: ${text(o['nama'])}', style: const TextStyle(fontSize: 14)),
        ),
      const SizedBox(height: 12),
      LabeledField(label: 'Justifikasi (Override Admin)', controller: _reason, maxLines: 3,
          hint: 'Wajib untuk sahkan, tolak atau padam'),
      Row(children: [
        Expanded(
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Tw.emerald600, foregroundColor: Colors.white),
            onPressed: _busy ? null : () => _run('verify'),
            child: const Text('Sahkan'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Tw.rose600, foregroundColor: Colors.white),
            onPressed: _busy ? null : () => _run('reject'),
            child: const Text('Tolak'),
          ),
        ),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        if (status.isNotEmpty && status != 'Belum Disahkan')
          Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _run('revert'), child: const Text('Kembalikan'))),
        if (status.isNotEmpty && status != 'Belum Disahkan') const SizedBox(width: 8),
        Expanded(
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600),
            onPressed: _busy ? null : () => _run(null),
            child: const Text('Padam'),
          ),
        ),
      ]),
    ]);
  }
}

/// Admin: write, edit and delete announcements (/api/announcements.php).
/// A new announcement notifies every active user and goes out on Telegram.
class AdminPengumumanScreen extends StatefulWidget {
  const AdminPengumumanScreen({super.key});

  @override
  State<AdminPengumumanScreen> createState() => _AdminPengumumanScreenState();
}

class _AdminPengumumanScreenState extends State<AdminPengumumanScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();

  Future<void> _edit([Map<String, dynamic>? item]) async {
    final saved = await showAppSheet<bool>(context, title: item == null ? 'Pengumuman baharu' : 'Edit pengumuman',
        builder: (_) => _AnnouncementForm(item: item));
    if (saved == true) await _view.currentState?.reload();
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final ok = await confirmSheet(context, title: 'Padam pengumuman?',
        message: 'Adakah anda pasti mahu memadam pengumuman "${text(item['title'])}"? Tindakan ini tidak boleh dibatalkan.',
        confirmLabel: 'Ya, Padam', color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    try {
      final result = await Api.instance.delete('/api/announcements.php', null, {'id': item['id']});
      if (mounted) showToast(context, text(result['message'], 'Pengumuman dipadam.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pengumuman')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Tambah'),
      ),
      body: AsyncView<List<Map<String, dynamic>>>(
        key: _view,
        load: () async => _rows((await Api.instance.get('/api/announcements.php'))['announcements']),
        builder: (context, items, reload) => RefreshList(onRefresh: reload, bottomPadding: 96, children: [
          if (items.isEmpty) const EmptyState(icon: Icons.campaign_outlined, title: 'Tiada pengumuman'),
          for (final item in items)
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(text(item['title']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                Text(text(item['created_at_formatted'] ?? item['created_at']),
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                const SizedBox(height: 6),
                Text(text(item['content']), maxLines: 3, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13.5, height: 1.4)),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  TextButton.icon(onPressed: () => _edit(item), icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text('Edit')),
                  TextButton.icon(
                    onPressed: () => _delete(item),
                    style: TextButton.styleFrom(foregroundColor: Tw.rose600),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Padam'),
                  ),
                ]),
              ]),
            ),
        ]),
      ),
    );
  }
}

class _AnnouncementForm extends StatefulWidget {
  const _AnnouncementForm({this.item});
  final Map<String, dynamic>? item;

  @override
  State<_AnnouncementForm> createState() => _AnnouncementFormState();
}

class _AnnouncementFormState extends State<_AnnouncementForm> {
  late final _title = TextEditingController(text: text(widget.item?['title'], ''));
  late final _content = TextEditingController(text: text(widget.item?['content'], ''));
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final body = {'title': _title.text.trim(), 'content': _content.text.trim()};
    if (body['title']!.isEmpty || body['content']!.isEmpty) {
      showToast(context, 'Tajuk dan kandungan diperlukan.', ToastType.warning);
      return;
    }
    if (widget.item == null) {
      final ok = await confirmSheet(context, title: 'Hantar pengumuman?',
          message: 'Pengumuman akan dihantar sebagai notifikasi kepada semua pengguna aktif dan ke Telegram.',
          confirmLabel: 'Hantar');
      if (!ok) return;
    }
    setState(() => _busy = true);
    try {
      final result = widget.item == null
          ? await Api.instance.post('/api/announcements.php', body)
          : await Api.instance.put('/api/announcements.php?id=${widget.item!['id']}', body);
      if (!mounted) return;
      showToast(context, text(result['message'], 'Pengumuman disimpan.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LabeledField(label: 'Tajuk', controller: _title, required: true),
      LabeledField(label: 'Kandungan', controller: _content, maxLines: 8, required: true),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: _busy
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
            : const Text('Simpan'),
      ),
    ]);
  }
}

/// Admin: pending fitness, written (Kelas III) and Kelas I test applications
/// (/api/admin-test-applications.php).
class AdminUjianScreen extends StatefulWidget {
  const AdminUjianScreen({super.key});

  @override
  State<AdminUjianScreen> createState() => _AdminUjianScreenState();
}

class _AdminUjianScreenState extends State<AdminUjianScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();
  String _type = 'fitness';

  Future<void> _decide(Map<String, dynamic> a, String action) async {
    String notes = '';
    if (action == 'reject') {
      final controller = TextEditingController();
      final ok = await confirmSheet(context, title: 'Tolak permohonan?', message: text(a['nama_penuh']),
          details: Padding(padding: const EdgeInsets.only(top: 12),
              child: LabeledField(label: 'Sebab penolakan', controller: controller, maxLines: 3, required: true)),
          confirmLabel: 'Tolak', color: Tw.rose600, textColor: Colors.white);
      notes = controller.text.trim();
      controller.dispose();
      if (!ok) return;
      if (notes.isEmpty) {
        if (mounted) showToast(context, 'Sebab penolakan diperlukan.', ToastType.warning);
        return;
      }
    } else {
      final ok = await confirmSheet(context, title: action == 'approve' ? 'Luluskan?' : 'Tandakan tidak hadir?',
          message: text(a['nama_penuh']), confirmLabel: action == 'approve' ? 'Lulus' : 'Tidak Hadir');
      if (!ok) return;
    }
    try {
      final result = await Api.instance.post('/api/admin-test-applications.php',
          {'id': a['id'], 'type': _type, 'action': action, 'notes': notes});
      if (mounted) showToast(context, text(result['message'], 'Dikemaskini.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Permohonan Ujian')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: FilterChips<String>(
            options: const [('fitness', 'Kecergasan'), ('bertulis', 'Kelas III'), ('kelas1', 'Kelas I')],
            value: _type,
            onChanged: (v) => setState(() => _type = v),
          ),
        ),
        Expanded(
          child: AsyncView<List<Map<String, dynamic>>>(
            key: _view,
            load: () async => _rows((await Api.instance.get('/api/admin-test-applications.php',
                {'type': _type, 'status': 'pending'}))['applications']),
            builder: (context, items, reload) => RefreshList(onRefresh: reload, children: [
              if (items.isEmpty) const EmptyState(icon: Icons.fact_check_outlined, title: 'Tiada permohonan menunggu'),
              for (final a in items)
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Row(children: [
                      Avatar(name: text(a['nama_penuh']), photo: a['url_gambar_profil'] as String?, radius: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(text(a['nama_penuh']), style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('${text(a['district_nama'])} · ${text(a['user_phone'])}',
                              style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text('${formLabel(a['jenis_borang'])} · Sesi ${text(a['tahun_permohonan'])}',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                    const SizedBox(height: 10),
                    if (text(a['workflow_status'], 'Pending') == 'Pending')
                      Row(children: [
                        Expanded(
                          child: FilledButton(
                            style: FilledButton.styleFrom(backgroundColor: Tw.emerald600, foregroundColor: Colors.white,
                                minimumSize: const Size(0, 40)),
                            onPressed: () => _decide(a, 'approve'),
                            child: const Text('Lulus'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                            onPressed: () => _decide(a, 'absent'),
                            child: const Text('Tidak Hadir'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600, minimumSize: const Size(0, 40)),
                            onPressed: () => _decide(a, 'reject'),
                            child: const Text('Tolak'),
                          ),
                        ),
                      ]),
                  ]),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Admin: registered referees or assessors for a year (/api/referees.php),
/// with grade changes and deactivation, like /admin/pengadil-berdaftar.
class AdminPengadilScreen extends StatefulWidget {
  const AdminPengadilScreen({super.key, this.assessors = false});
  final bool assessors;

  @override
  State<AdminPengadilScreen> createState() => _AdminPengadilScreenState();
}

class _AdminPengadilScreenState extends State<AdminPengadilScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();
  int _year = DateTime.now().year;
  String _query = '';

  Future<void> _open(Map<String, dynamic> r) async {
    final changed = await showAppSheet<bool>(context, builder: (_) => _RefereeSheet(row: r, assessor: widget.assessors));
    if (changed == true) await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final thisYear = DateTime.now().year;
    return Scaffold(
      appBar: AppBar(title: Text(widget.assessors ? 'Penilai Berdaftar' : 'Pengadil Berdaftar')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: FilterChips<int>(
            options: [for (var y = thisYear + 1; y >= thisYear - 2; y--) (y, '$y')],
            value: _year,
            onChanged: (y) => setState(() => _year = y),
          ),
        ),
        Expanded(
          child: AsyncView<List<Map<String, dynamic>>>(
            key: _view,
            load: () async => _rows((await Api.instance.get('/api/referees.php',
                {'year': _year, if (widget.assessors) 'type': 'penilai_berdaftar'}))['data']),
            builder: (context, all, reload) {
              final q = _query.toLowerCase();
              final shown = all.where((r) =>
                  q.isEmpty || '${r['nama_penuh']} ${r['no_kp']} ${r['persatuan']}'.toLowerCase().contains(q)).toList();
              return RefreshList(onRefresh: reload, children: [
                TextField(
                  decoration: const InputDecoration(hintText: 'Cari nama, No. KP atau persatuan',
                      prefixIcon: Icon(Icons.search_rounded)),
                  onChanged: (v) => setState(() => _query = v.trim()),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 10, 4, 6),
                  child: Text('${shown.length} daripada ${all.length} berdaftar untuk $_year',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                ),
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
                          subtitle: Text('${text(r['jenis_pengadil'])} · ${text(r['persatuan'])}', maxLines: 1,
                              overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                        ),
                      ],
                    ]),
                  ),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}

class _RefereeSheet extends StatefulWidget {
  const _RefereeSheet({required this.row, required this.assessor});
  final Map<String, dynamic> row;
  final bool assessor;

  @override
  State<_RefereeSheet> createState() => _RefereeSheetState();
}

class _RefereeSheetState extends State<_RefereeSheet> {
  bool _busy = false;

  int get _userId => _int(widget.row['user_id']);

  Future<void> _grade(String taraf, bool on) async {
    setState(() => _busy = true);
    try {
      final result = await Api.instance.post('/api/pengadil-taraf.php', {'user_ids': [_userId], 'taraf': taraf, 'value': on ? 1 : 0});
      if (!mounted) return;
      showToast(context, text(result['message'], 'Taraf dikemaskini.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deactivate() async {
    final ok = await confirmSheet(context, title: 'Nyahaktif akaun?',
        message: 'Nyahaktif akaun ${text(widget.row['nama_penuh'])}? Sejarah perlawanan dan permohonan akan kekal.',
        confirmLabel: 'Nyahaktif', color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    setState(() => _busy = true);
    try {
      final result = await Api.instance.delete('/api/admin-delete-referee.php', null, {'id': _userId});
      if (!mounted) return;
      showToast(context, text(result['message'], 'Akaun dinyahaktifkan.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(
          (await Api.instance.get('/api/profil-pengadil.php', {'id': _userId}))['profil'] as Map),
      builder: (context, p, _) {
        final stats = Map<String, dynamic>.from(p['stats'] as Map? ?? {});
        final grades = [('kebangsaan', 'Kebangsaan', 'pengadil_kebangsaan'), ('negeri', 'Negeri', 'pengadil_negeri'),
            ('daerah', 'Daerah', 'pengadil_daerah')];
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: text(p['nama_penuh']), photo: p['url_gambar_profil'] as String?, radius: 28),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(p['nama_penuh']), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                Text('${text(p['jenis_pengadil'])} · ${text(p['nama_persatuan'])}',
                    style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: MiniStat(label: 'Tugasan', value: stats['tugasan_total'])),
            const SizedBox(width: 8),
            Expanded(child: MiniStat(label: 'Diterima', value: stats['tugasan_diterima'], color: Tw.emerald500)),
            const SizedBox(width: 8),
            Expanded(child: MiniStat(label: 'Perlawanan', value: stats['jumlah_perlawanan'], color: AppColors.grey200)),
          ]),
          const SizedBox(height: 8),
          DetailRow(Icons.phone_outlined, 'No. telefon', text(p['no_telefon']),
              onTap: () => callNumber(context, text(p['no_telefon'], ''))),
          DetailRow(Icons.mail_outline, 'Emel', text(p['email'])),
          DetailRow(Icons.badge_outlined, 'No. KP', text(p['no_ic'])),
          if (!widget.assessor) ...[
            const SizedBox(height: 8),
            const Text('Taraf pengadil', style: TextStyle(fontWeight: FontWeight.w700)),
            for (final (taraf, label, key) in grades)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Pengadil $label'),
                value: '${p[key]}' == '1',
                activeTrackColor: AppColors.black,
                activeThumbColor: Tw.pahangYellow,
                onChanged: _busy ? null : (on) => _grade(taraf, on),
              ),
          ],
          if ('${p['aktif']}' == '1' && text(p['role'], '') == 'Pengadil') ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600),
              onPressed: _busy ? null : _deactivate,
              icon: const Icon(Icons.person_off_outlined, size: 18),
              label: const Text('Nyahaktif akaun'),
            ),
          ],
        ]);
      },
    );
  }
}

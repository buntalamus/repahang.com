import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _jawatanList = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];
const _requiredJawatan = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'];
const _active = ['Belum Jawab', 'Diterima'];

/// Appoint officials to one match (Admin and PP Daerah) with the website's
/// /api/lantikan.php calls: GET ?jadual_id, POST assign, DELETE ?id, POST notify.
class LantikScreen extends StatefulWidget {
  const LantikScreen({super.key, required this.match});
  final Map<String, dynamic> match;

  @override
  State<LantikScreen> createState() => _LantikScreenState();
}

class _LantikScreenState extends State<LantikScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  List<Map<String, dynamic>> _list = [];
  bool _sending = false;

  Map<String, dynamic> get m => widget.match;

  Map<String, dynamic>? _assignment(String jawatan) {
    final rows = _list.where((a) => a['jawatan'] == jawatan).toList();
    if (rows.isEmpty) return null;
    // Prefer the live appointment over older rejected/cancelled rows for the slot.
    return rows.firstWhere((a) => _active.contains(a['status']), orElse: () => rows.last);
  }

  Future<void> _assign(String jawatan, List<Map<String, dynamic>> pool, String regionLabel) async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _PoolPicker(jawatan: jawatan, pool: pool, regionLabel: regionLabel),
    );
    if (picked == null || !mounted) return;
    final body = <String, dynamic>{'jadual_id': m['id'], 'jawatan': jawatan};
    if (picked['pengadil_id'] != null) {
      body['pengadil_id'] = picked['pengadil_id'];
    } else {
      body['pengadil_luar_id'] = picked['pengadil_luar_id'];
    }
    try {
      final result = await Api.instance.post('/api/lantikan.php', body);
      if (mounted) showToast(context, text(result['message'], 'Pegawai dilantik.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  Future<void> _remove(Map<String, dynamic> a) async {
    final ok = await confirmSheet(context, title: 'Buang lantikan?', message: 'Buang ${text(a['nama_penuh'])} daripada '
        '${a['jawatan']}?', confirmLabel: 'Buang', color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    try {
      final result = await Api.instance.delete('/api/lantikan.php', null, {'id': a['id']});
      if (mounted) showToast(context, text(result['message'], 'Lantikan dibuang.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  /// Cancels or postpones the match with a reason, like the website's match
  /// status dialog; the server notifies the appointed officials.
  Future<void> _changeStatus(String status) async {
    final cancel = status == 'Dibatalkan';
    final sebab = await showAppSheet<String>(context,
        title: cancel ? 'Batal perlawanan' : 'Tangguh perlawanan',
        builder: (_) => _ReasonForm(cancel: cancel));
    if (sebab == null || !mounted) return;
    try {
      final result = await Api.instance.post('/api/lantikan.php',
          {'action': 'batal_jadual', 'jadual_id': m['id'], 'status': status, 'sebab': sebab});
      if (!mounted) return;
      showToast(context, text(result['message'], cancel ? 'Perlawanan dibatalkan.' : 'Perlawanan ditangguhkan.'));
      Navigator.pop(context);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  Future<void> _notify() async {
    final missing = _requiredJawatan.where((j) => !_active.contains(_assignment(j)?['status'])).toList();
    if (missing.isNotEmpty) {
      showToast(context, 'Slot wajib belum lengkap: ${missing.join(', ')}.', ToastType.error);
      return;
    }
    final pending = _list.where((a) => a['status'] == 'Belum Jawab').length;
    if (pending == 0) {
      showToast(context, 'Tiada pegawai berstatus Belum Jawab untuk dimaklumkan.', ToastType.warning);
      return;
    }
    final ok = await confirmSheet(context, title: 'Hantar notifikasi?',
        message: 'Notifikasi lantikan akan dihantar kepada $pending pegawai yang belum menjawab.', confirmLabel: 'Hantar');
    if (!ok) return;
    setState(() => _sending = true);
    try {
      final result = await Api.instance.post('/api/lantikan.php', {'action': 'notify', 'jadual_id': m['id']});
      if (mounted) showToast(context, text(result['message'], 'Notifikasi dihantar.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
    await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lantik pegawai', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Status perlawanan',
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: _changeStatus,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'Ditangguhkan', child: ListTile(
                  contentPadding: EdgeInsets.zero, leading: Icon(Icons.pause_circle_outline_rounded, color: Tw.orange600),
                  title: Text('Tangguh perlawanan'))),
              PopupMenuItem(value: 'Dibatalkan', child: ListTile(
                  contentPadding: EdgeInsets.zero, leading: Icon(Icons.cancel_outlined, color: Tw.rose600),
                  title: Text('Batal perlawanan'))),
            ],
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            onPressed: _sending ? null : _notify,
            icon: _sending
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                : const Icon(Icons.send_rounded),
            label: const Text('Hantar notifikasi'),
          ),
        ),
      ),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        load: () async {
          final body = await Api.instance.get('/api/lantikan.php', {'jadual_id': m['id']});
          _list = (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          return body;
        },
        builder: (context, body, reload) {
          final pool = (body['referees'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final region = text(body['region_label'], 'Negeri');
          return RefreshList(onRefresh: reload, children: [
            AppCard(
              color: AppColors.black,
              child: Row(children: [
                DateBlock(m['tarikh'], highlight: true),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${formatTime(m['masa'])} · ${text(m['no_perlawanan'])}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white70)),
                    Text('${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                    Text(text(m['tempat']), style: const TextStyle(fontSize: 13, color: Colors.white70)),
                  ]),
                ),
              ]),
            ),
            SectionTitle('Pegawai perlawanan · ${pool.length} dalam pool'),
            for (final jawatan in _jawatanList) _slot(jawatan, _assignment(jawatan), pool, region),
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Lantikan kumpulan dan log audit di website. Batal atau tangguh melalui menu ⋮ di atas.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.muted)),
            ),
          ]);
        },
      ),
    );
  }

  Widget _slot(String jawatan, Map<String, dynamic>? a, List<Map<String, dynamic>> pool, String region) {
    final required = _requiredJawatan.contains(jawatan);
    final live = a != null && _active.contains(a['status']);
    final status = text(a?['status'], '');
    final phone = text(a?['no_telefon']);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      onTap: live ? null : () => _assign(jawatan, pool, region),
      child: Row(children: [
        live
            ? Avatar(name: text(a['nama_penuh'], ''), radius: 22)
            : CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.background,
                child: Icon(Icons.person_add_alt_1_rounded, color: required ? Tw.rose500 : AppColors.faint),
              ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: jawatan),
              if (required) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
            ]), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
            if (!live)
              Text(a == null ? 'Tekan untuk melantik' : '${text(a['nama_penuh'])} · $status',
                  style: TextStyle(fontSize: 14, color: a == null ? AppColors.faint : Tw.rose700))
            else ...[
              Text(text(a['nama_penuh']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Wrap(spacing: 6, children: [
                Pill(status, appointmentTone(status)),
                if ('${a['telegram_linked']}' != '1') const Pill('Tiada Telegram', (Tw.slate100, Tw.slate500)),
              ]),
            ],
          ]),
        ),
        if (live && phone != '-')
          IconButton(
            tooltip: 'Panggil',
            onPressed: () => callNumber(context, phone),
            icon: const Icon(Icons.call_rounded, color: Tw.emerald600),
          ),
        if (live)
          IconButton(
            tooltip: 'Buang lantikan',
            onPressed: () => _remove(a),
            icon: const Icon(Icons.person_remove_outlined, color: Tw.rose500),
          )
        else
          const Padding(padding: EdgeInsets.only(right: 8), child: Icon(Icons.add_circle_rounded, color: AppColors.black)),
      ]),
    );
  }
}

/// Searchable list of the tournament pool.
class _PoolPicker extends StatefulWidget {
  const _PoolPicker({required this.jawatan, required this.pool, required this.regionLabel});
  final String jawatan;
  final List<Map<String, dynamic>> pool;
  final String regionLabel;

  @override
  State<_PoolPicker> createState() => _PoolPickerState();
}

class _PoolPickerState extends State<_PoolPicker> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final q = _search.toLowerCase();
    final list = widget.pool.where((r) {
      if (q.isEmpty) return true;
      return [r['nama_penuh'], r['daerah'], r['negeri'], r['no_telefon'], r['jenis_pengadil']]
          .any((v) => '${v ?? ''}'.toLowerCase().contains(q));
    }).toList();
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.85,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Lantik ${widget.jawatan}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(
              onChanged: (value) => setState(() => _search = value),
              decoration: const InputDecoration(
                hintText: 'Cari nama, daerah, telefon',
                prefixIcon: Icon(Icons.search_rounded),
                fillColor: AppColors.background,
              ),
            ),
          ]),
        ),
        Expanded(
          child: list.isEmpty
              ? const EmptyState(icon: Icons.person_search_rounded, title: 'Tiada pegawai dijumpai')
              : ListView.builder(
                  padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom + 16),
                  itemCount: list.length,
                  itemBuilder: (context, index) {
                    final r = list[index];
                    final needsTelegram = '${r['telegram_required']}' == '1';
                    return ListTile(
                      enabled: !needsTelegram,
                      onTap: () => Navigator.pop(context, r),
                      leading: Avatar(name: text(r['nama_penuh'], ''), radius: 20),
                      title: Text(text(r['nama_penuh']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        needsTelegram
                            ? 'Perlu hubungkan Telegram sebelum dilantik'
                            : '${text(r['jenis_pengadil'])} · ${text(r['wilayah'])} · ${text(r['jumlah_lantikan_kejohanan'], '0')} lantikan',
                        style: TextStyle(fontSize: 12, color: needsTelegram ? Tw.rose600 : AppColors.muted),
                      ),
                      trailing: r['jenis_sumber'] == 'Luar' ? const Pill('Luar', (Tw.purple50, Tw.purple700)) : null,
                    );
                  },
                ),
        ),
      ]),
    );
  }
}

class _ReasonForm extends StatefulWidget {
  const _ReasonForm({required this.cancel});
  final bool cancel;

  @override
  State<_ReasonForm> createState() => _ReasonFormState();
}

class _ReasonFormState extends State<_ReasonForm> {
  final _sebab = TextEditingController();

  @override
  void dispose() {
    _sebab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(
        widget.cancel
            ? 'Semua lantikan aktif bagi perlawanan ini akan dibatalkan dan pegawai dimaklumkan.'
            : 'Perlawanan ditanda ditangguhkan dan pegawai yang dilantik dimaklumkan.',
        style: const TextStyle(fontSize: 14, color: Tw.slate600, height: 1.5),
      ),
      const SizedBox(height: 16),
      LabeledField(label: 'Sebab', required: true, controller: _sebab, maxLines: 3,
          hint: widget.cancel ? 'Contoh: Padang tidak boleh digunakan' : 'Contoh: Hujan lebat'),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: widget.cancel ? Tw.rose600 : Tw.orange600, foregroundColor: Colors.white),
        onPressed: () {
          final text = _sebab.text.trim();
          if (text.isEmpty) {
            showToast(context, 'Sila nyatakan sebab.', ToastType.warning);
            return;
          }
          Navigator.pop(context, text.length > 500 ? text.substring(0, 500) : text);
        },
        child: Text(widget.cancel ? 'Sahkan batal' : 'Sahkan tangguh'),
      ),
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Kembali')),
    ]);
  }
}

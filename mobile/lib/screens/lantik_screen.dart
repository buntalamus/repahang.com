import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

const _jawatanList = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2', 'Pegawai ke4', 'Penilai Pengadil'];
const _requiredJawatan = ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'];
const _active = ['Belum Jawab', 'Diterima'];

/// Appoint officials to one match (Admin and PP Daerah), using the same
/// /api/lantikan.php calls as the website's lantikan-pengadil page:
/// GET ?jadual_id → assignments + pool, POST assign, DELETE ?id, POST notify.
class LantikScreen extends StatefulWidget {
  const LantikScreen({super.key, required this.match});
  final Map<String, dynamic> match;

  @override
  State<LantikScreen> createState() => _LantikScreenState();
}

class _LantikScreenState extends State<LantikScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  bool _sending = false;

  Map<String, dynamic> get m => widget.match;

  Future<Map<String, dynamic>> _load() => Api.instance.get('/api/lantikan.php', {'jadual_id': m['id']});

  Map<String, dynamic>? _assignment(List<Map<String, dynamic>> list, String jawatan) {
    final rows = list.where((a) => a['jawatan'] == jawatan).toList();
    if (rows.isEmpty) return null;
    // Prefer the live appointment over older rejected/cancelled rows for the slot.
    return rows.firstWhere((a) => _active.contains(a['status']), orElse: () => rows.last);
  }

  Future<void> _assign(String jawatan, List<Map<String, dynamic>> pool, String regionLabel) async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
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
    final ok = await _confirm('Buang Lantikan', 'Buang lantikan untuk ${a['jawatan']}?', 'Buang', Tw.rose500);
    if (ok != true) return;
    try {
      final result = await Api.instance.delete('/api/lantikan.php', null, {'id': a['id']});
      if (mounted) showToast(context, text(result['message'], 'Lantikan dibuang.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  Future<void> _notify(List<Map<String, dynamic>> list) async {
    final missing = _requiredJawatan.where((j) => !_active.contains(_assignment(list, j)?['status'])).toList();
    if (missing.isNotEmpty) {
      showToast(context, 'Slot wajib belum lengkap: ${missing.join(', ')}.', ToastType.error);
      return;
    }
    final pending = list.where((a) => a['status'] == 'Belum Jawab').length;
    if (pending == 0) {
      showToast(context, 'Tiada pengadil dengan status Belum Jawab untuk dihantar notifikasi.', ToastType.error);
      return;
    }
    final ok = await _confirm('Hantar Notifikasi',
        'Hantar notifikasi kepada $pending pegawai perlawanan (status Belum Jawab)?', 'Hantar', Tw.pahangBlack);
    if (ok != true) return;
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

  Future<bool?> _confirm(String title, String message, String action, Color color) => showWebModal<bool>(
        context,
        title: title,
        body: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(message, style: const TextStyle(fontSize: 14, color: Tw.slate600)),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            OutlineButton(label: 'Batal', onPressed: () => Navigator.pop(context, false)),
            const SizedBox(width: 12),
            SolidButton(label: action, color: color, onPressed: () => Navigator.pop(context, true)),
          ]),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lantik Pegawai', style: TextStyle(fontSize: 18))),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        loadingMessage: 'Memuatkan lantikan...',
        load: _load,
        builder: (context, body, reload) {
          final list = (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final pool = (body['referees'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final region = text(body['region_label'], 'Negeri');
          return RefreshIndicator(
            color: Tw.pahangBlack,
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              WebCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${text(m['no_perlawanan'])} — ${text(m['kumpulan_tahap'] ?? m['kategori'], '')}',
                      style: const TextStyle(fontSize: 12, color: Tw.slate500)),
                  const SizedBox(height: 4),
                  Text('${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Tw.slate800)),
                  const SizedBox(height: 4),
                  Text('${formatDate(m['tarikh'])}, ${text(m['hari'], '')}, ${formatTime(m['masa'])}',
                      style: const TextStyle(fontSize: 12, color: Tw.slate500)),
                  Text(text(m['tempat']), style: const TextStyle(fontSize: 12, color: Tw.slate500)),
                ]),
              ),
              WebCard(
                padding: EdgeInsets.zero,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Tw.slate100))),
                    child: CardTitle('Pegawai Perlawanan (${pool.length} dalam pool)', icon: Icons.groups_outlined),
                  ),
                  for (var i = 0; i < _jawatanList.length; i++)
                    _slot(i, _jawatanList[i], _assignment(list, _jawatanList[i]), pool, region),
                ]),
              ),
              SolidButton(
                label: _sending ? 'Menghantar...' : 'Hantar Notifikasi',
                color: Tw.pahangBlack,
                expand: true,
                busy: _sending,
                onPressed: () => _notify(list),
              ),
              const SizedBox(height: 8),
              const Text(
                'Lantikan kumpulan, batal/tangguh perlawanan dan log audit kekal di website.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Tw.slate500),
              ),
            ]),
          );
        },
      ),
    );
  }

  Widget _slot(int index, String jawatan, Map<String, dynamic>? a, List<Map<String, dynamic>> pool, String region) {
    final required = _requiredJawatan.contains(jawatan);
    final live = a != null && _active.contains(a['status']);
    final status = text(a?['status'], '');
    final phone = text(a?['no_telefon']);
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 8, 12),
      decoration: BoxDecoration(border: index == 0 ? null : const Border(top: BorderSide(color: Tw.slate100))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: jawatan),
              if (required) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
            ]), style: const TextStyle(fontSize: 12, color: Tw.slate500)),
            if (a == null)
              const Text('Belum dilantik', style: TextStyle(fontSize: 14, color: Tw.slate400))
            else ...[
              Text(text(a['nama_penuh']),
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: live ? Tw.slate800 : Tw.slate400,
                      decoration: live ? null : TextDecoration.lineThrough)),
              Row(children: [
                StatusBadge(status, appointmentTone(status), small: true),
                const SizedBox(width: 6),
                if ('${a['telegram_linked']}' != '1')
                  const StatusBadge('Tiada Telegram', (Tw.slate100, Tw.slate500), small: true),
              ]),
              if (text(a['komen'], '').isNotEmpty)
                Text(text(a['komen']), style: const TextStyle(fontSize: 12, color: Tw.slate400, fontStyle: FontStyle.italic)),
            ],
          ]),
        ),
        if (live && phone != '-')
          IconButton(
            tooltip: 'Panggil ${text(a['nama_penuh'])}',
            onPressed: () => callNumber(context, phone),
            icon: const Icon(Icons.call, size: 20, color: Tw.emerald600),
          ),
        if (live)
          IconButton(
            tooltip: 'Buang lantikan',
            onPressed: () => _remove(a),
            icon: const Icon(Icons.person_remove_outlined, size: 20, color: Tw.rose500),
          )
        else
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: YellowButton(label: a == null ? 'Lantik' : 'Ganti', onPressed: () => _assign(jawatan, pool, region)),
          ),
      ]),
    );
  }
}

/// Searchable list of the tournament pool, like the website's referee picker.
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
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Lantik ${widget.jawatan}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            TextField(
              autofocus: false,
              onChanged: (value) => setState(() => _search = value),
              decoration: const InputDecoration(
                hintText: 'Cari nama, daerah, telefon...',
                prefixIcon: Icon(Icons.search, color: Tw.gray400, size: 20),
              ),
            ),
          ]),
        ),
        Expanded(
          child: list.isEmpty
              ? const Center(child: Text('Tiada pegawai dalam pool.', style: TextStyle(color: Tw.slate400)))
              : ListView.separated(
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final r = list[index];
                    final needsTelegram = '${r['telegram_required']}' == '1';
                    return ListTile(
                      enabled: !needsTelegram,
                      onTap: () => Navigator.pop(context, r),
                      title: Text(text(r['nama_penuh']),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Tw.slate800)),
                      subtitle: Text(
                        '${text(r['jenis_pengadil'])} · ${widget.regionLabel}: ${text(r['wilayah'])} · '
                        '${text(r['jumlah_lantikan_kejohanan'], '0')} lantikan'
                        '${needsTelegram ? '\nPerlu hubungkan Telegram sebelum dilantik' : ''}',
                        style: TextStyle(fontSize: 12, color: needsTelegram ? Tw.rose600 : Tw.slate500),
                      ),
                      trailing: StatusBadge(text(r['jenis_sumber']),
                          r['jenis_sumber'] == 'Luar' ? (Tw.purple50, Tw.purple700) : (Tw.slate100, Tw.slate600),
                          small: true),
                    );
                  },
                ),
        ),
      ]),
    );
  }
}

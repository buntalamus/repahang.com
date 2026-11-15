import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'lantik_screen.dart';
import 'tambah_jadual_screen.dart';

/// Appointments for Admin and PP Daerah: tournaments → matches → appoint
/// officials (LantikScreen). Bulk actions stay on the website.
class LantikanAdminScreen extends StatefulWidget {
  const LantikanAdminScreen({super.key});

  @override
  State<LantikanAdminScreen> createState() => _LantikanAdminScreenState();
}

class _LantikanAdminScreenState extends State<LantikanAdminScreen> {
  bool _activeOnly = true;
  String _source = 'admin';

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      load: () async => ((await Api.instance.get('/api/kejohanan.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      builder: (context, all, reload) {
        final isAdmin = Api.instance.user.value?.isAdmin ?? false;
        final items = all.where((k) {
          if (_activeOnly && k['status'] == 'Selesai') return false;
          final source = k['lantikan_persatuan_id'] == null ? 'admin' : 'pp';
          return !isAdmin || _source == 'all' || source == _source;
        }).toList();
        return RefreshList(onRefresh: reload, children: [
          if (isAdmin)
            FilterChips<String>(
              options: const [('admin', 'Lantikan Admin'), ('pp', 'Lantikan PP Daerah'), ('all', 'Semua Lantikan')],
              value: _source,
              onChanged: (value) => setState(() => _source = value),
            ),
          FilterChips<bool>(
            options: [(true, 'Aktif'), (false, 'Semua')],
            value: _activeOnly,
            onChanged: (v) => setState(() => _activeOnly = v),
          ),
          Text('${items.length} kejohanan', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: 8),
          if (items.isEmpty) const EmptyState(icon: Icons.emoji_events_outlined, title: 'Tiada kejohanan'),
          for (final k in items)
            AppCard(
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => _JadualScreen(tournament: k))),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Tw.pahangYellow, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.emoji_events_rounded, color: AppColors.black),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(text(k['nama']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text('${formatDate(k['tarikh_mula'])} – ${formatDate(k['tarikh_akhir'])}',
                        style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      Pill(text(k['jenis_kejohanan'], 'Persahabatan'), tournamentTone(text(k['jenis_kejohanan'], ''))),
                      Pill('${text(k['jumlah_perlawanan'], '0')} perlawanan', (AppColors.background, Tw.slate600)),
                      if (isAdmin)
                        Pill(k['lantikan_persatuan_id'] == null ? 'Admin Negeri' : text(k['lantikan_daerah_nama'], 'PP Daerah'),
                            (AppColors.background, Tw.slate600)),
                      if (k['status'] == 'Selesai') const Pill('Selesai', (Tw.gray100, Tw.gray600)),
                    ]),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
              ]),
            ),
        ]);
      },
    );
  }
}

class _JadualScreen extends StatefulWidget {
  const _JadualScreen({required this.tournament});
  final Map<String, dynamic> tournament;

  @override
  State<_JadualScreen> createState() => _JadualScreenState();
}

class _JadualScreenState extends State<_JadualScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();
  String _date = '';
  String _search = '';

  String _matchDate(Map<String, dynamic> match) =>
      RegExp(r'^\d{4}-\d{2}-\d{2}').stringMatch('${match['tarikh'] ?? ''}') ?? '';

  bool _matchesSearch(Map<String, dynamic> match) {
    final query = _search.trim().toLowerCase();
    if (query.isEmpty) return true;
    if (RegExp(r'^\d+$').hasMatch(query)) {
      final number = RegExp(r'(\d+)\s*$').firstMatch('${match['no_perlawanan'] ?? ''}');
      return number != null && int.tryParse(number[1]!) == int.tryParse(query);
    }
    return ['no_perlawanan', 'pasukan_home', 'pasukan_away', 'tempat', 'kategori', 'peringkat', 'kumpulan']
        .any((key) => '${match[key] ?? ''}'.toLowerCase().contains(query));
  }

  Map<String, dynamic> get tournament => widget.tournament;

  Future<void> _add() async {
    final message = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => TambahJadualScreen(tournament: tournament)));
    if (message == null || !mounted) return;
    showToast(context, message);
    await _view.currentState?.reload();
  }

  Future<void> _delete(Map<String, dynamic> m) async {
    final ok = await confirmSheet(context,
        title: 'Padam perlawanan?',
        message: '${text(m['no_perlawanan'])}: ${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])} '
            'pada ${formatDate(m['tarikh'])} akan dipadam daripada jadual.',
        confirmLabel: 'Padam',
        color: Tw.rose600,
        textColor: Colors.white);
    if (!ok) return;
    try {
      final result = await Api.instance.delete('/api/jadual-perlawanan.php', null, {'id': m['id']});
      if (mounted) showToast(context, text(result['message'], 'Perlawanan dipadam.'));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    return Scaffold(
      appBar: AppBar(title: Text(text(tournament['nama']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Tambah perlawanan'),
      ),
      body: AsyncView<List<Map<String, dynamic>>>(
        key: _view,
        load: () async => ((await Api.instance.get('/api/jadual-perlawanan.php', {'kejohanan_id': tournament['id']}))['data']
                as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
        builder: (context, matches, reload) {
          final counts = <String, int>{};
          for (final match in matches) {
            final date = _matchDate(match);
            if (date.isNotEmpty) counts[date] = (counts[date] ?? 0) + 1;
          }
          final dates = counts.keys.toList()..sort();
          // Keep a selected date available even if its last match was deleted.
          if (_date.isNotEmpty && !dates.contains(_date)) {
            dates.add(_date);
            dates.sort();
          }
          final index = dates.indexOf(_date);
          final visible = matches.where((match) =>
              (_date.isEmpty || _matchDate(match) == _date) && _matchesSearch(match)).toList();
          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (!keyboardOpen) ...[
                DropdownButtonFormField<String>(
                  key: ValueKey(_date),
                  initialValue: _date,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Hari / tarikh perlawanan'),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Semua hari')),
                    for (final date in dates)
                      DropdownMenuItem(value: date, child: Text(
                        '${formatDayDate(date)} ${parseDate(date)!.year} · ${counts[date] ?? 0} perlawanan',
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      )),
                  ],
                  onChanged: (value) { if (value != null) setState(() => _date = value); },
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: index > 0 ? () => setState(() => _date = dates[index - 1]) : null,
                    child: const Text('‹ Sebelum'),
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(
                    onPressed: dates.isNotEmpty && index < dates.length - 1
                        ? () => setState(() => _date = dates[index + 1]) : null,
                    child: const Text('Seterusnya ›'),
                  )),
                ]),
                const SizedBox(height: 8),
                ],
                TextField(
                  decoration: const InputDecoration(labelText: 'Cari perlawanan',
                    hintText: 'No., pasukan atau tempat', prefixIcon: Icon(Icons.search_rounded)),
                  onChanged: (value) => setState(() => _search = value),
                ),
                const SizedBox(height: 8),
                Text('${visible.length} daripada ${matches.length} perlawanan',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              ]),
            ),
            Expanded(child: RefreshList(onRefresh: reload, bottomPadding: 96, children: [
              if (matches.isEmpty)
                const EmptyState(icon: Icons.event_busy_rounded, title: 'Tiada jadual perlawanan',
                    subtitle: 'Tekan "Tambah perlawanan" untuk menambah jadual.')
              else if (visible.isEmpty)
                const EmptyState(icon: Icons.search_off_rounded, title: 'Tiada perlawanan sepadan',
                    subtitle: 'Pilih hari lain atau ubah carian.'),
              for (final m in visible) _matchCard(m, reload),
            ])),
          ]);
        },
      ),
    );
  }

  Widget _matchCard(Map<String, dynamic> m, Future<void> Function() reload) {
    final assigned = int.tryParse('${m['jumlah_lantikan'] ?? 0}') ?? 0;
    final accepted = int.tryParse('${m['jumlah_terima'] ?? 0}') ?? 0;
    final complete = assigned > 0 && accepted >= assigned;
    final status = text(m['status'], '');
    return AppCard(
      accent: assigned == 0 ? Tw.rose500 : (complete ? null : Tw.pahangYellow),
      padding: const EdgeInsets.fromLTRB(16, 16, 4, 16),
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LantikScreen(match: m)));
        await reload();
      },
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DateBlock(m['tarikh']),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${formatTime(m['masa'])} · ${text(m['no_perlawanan'])}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
            Text('${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            Text(text(m['tempat']), maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              Pill(
                assigned == 0 ? 'Belum dilantik' : '$accepted/$assigned terima',
                assigned == 0 ? (Tw.rose50, Tw.rose700) : (complete ? (Tw.emerald50, Tw.emerald700) : (Tw.amber50, Tw.amber700)),
                icon: Icons.groups_rounded,
              ),
              if (status.isNotEmpty && status != 'Dijadualkan') Pill(status, appointmentTone(status)),
            ]),
          ]),
        ),
        // Matches with officials keep their history, so only empty ones offer delete.
        if (assigned == 0)
          PopupMenuButton<String>(
            tooltip: 'Pilihan perlawanan',
            icon: const Icon(Icons.more_vert_rounded, color: AppColors.muted),
            onSelected: (_) => _delete(m),
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(Icons.delete_outline_rounded, color: Tw.rose600),
                  SizedBox(width: 12),
                  Text('Padam perlawanan', style: TextStyle(color: Tw.rose600)),
                ]),
              ),
            ],
          )
        else
          const Padding(padding: EdgeInsets.fromLTRB(4, 0, 8, 0), child: Icon(Icons.chevron_right_rounded, color: AppColors.faint)),
      ]),
    );
  }
}

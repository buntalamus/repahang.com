import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'lantik_screen.dart';

/// Appointments for Admin and PP Daerah: tournaments → matches → appoint
/// officials (LantikScreen). Bulk actions stay on the website.
class LantikanAdminScreen extends StatefulWidget {
  const LantikanAdminScreen({super.key});

  @override
  State<LantikanAdminScreen> createState() => _LantikanAdminScreenState();
}

class _LantikanAdminScreenState extends State<LantikanAdminScreen> {
  bool _activeOnly = true;

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      load: () async => ((await Api.instance.get('/api/kejohanan.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      builder: (context, all, reload) {
        final items = _activeOnly ? all.where((k) => k['status'] != 'Selesai').toList() : all;
        return RefreshList(onRefresh: reload, children: [
          FilterChips<bool>(
            options: [(true, 'Aktif'), (false, 'Semua')],
            value: _activeOnly,
            onChanged: (v) => setState(() => _activeOnly = v),
          ),
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

class _JadualScreen extends StatelessWidget {
  const _JadualScreen({required this.tournament});
  final Map<String, dynamic> tournament;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(text(tournament['nama']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
      body: AsyncView<List<Map<String, dynamic>>>(
        load: () async => ((await Api.instance.get('/api/jadual-perlawanan.php', {'kejohanan_id': tournament['id']}))['data']
                as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
        builder: (context, matches, reload) => RefreshList(onRefresh: reload, children: [
          if (matches.isEmpty) const EmptyState(icon: Icons.event_busy_rounded, title: 'Tiada jadual perlawanan'),
          for (final m in matches) _matchCard(context, m, reload),
        ]),
      ),
    );
  }

  Widget _matchCard(BuildContext context, Map<String, dynamic> m, Future<void> Function() reload) {
    final assigned = int.tryParse('${m['jumlah_lantikan'] ?? 0}') ?? 0;
    final accepted = int.tryParse('${m['jumlah_terima'] ?? 0}') ?? 0;
    final complete = assigned > 0 && accepted >= assigned;
    final status = text(m['status'], '');
    return AppCard(
      accent: assigned == 0 ? Tw.rose500 : (complete ? null : Tw.pahangYellow),
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
        const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
      ]),
    );
  }
}

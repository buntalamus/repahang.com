import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'lantik_screen.dart';

/// Matches in the next 14 days whose required officials are incomplete
/// (/api/lantikan-perlu-tindakan.php); tap one to appoint a replacement.
class PerluTindakanScreen extends StatefulWidget {
  const PerluTindakanScreen({super.key});

  static Future<List<Map<String, dynamic>>> fetch() async =>
      ((await Api.instance.get('/api/lantikan-perlu-tindakan.php'))['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  @override
  State<PerluTindakanScreen> createState() => _PerluTindakanScreenState();
}

class _PerluTindakanScreenState extends State<PerluTindakanScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Perlu tindakan', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
      body: AsyncView<List<Map<String, dynamic>>>(
        key: _view,
        load: PerluTindakanScreen.fetch,
        builder: (context, items, reload) => RefreshList(onRefresh: reload, children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, 12),
            child: Text('Perlawanan 14 hari akan datang yang belum lengkap Pengadil, Penolong Pengadil 1 atau 2.',
                style: TextStyle(fontSize: 13, color: AppColors.muted)),
          ),
          if (items.isEmpty)
            const EmptyState(icon: Icons.verified_rounded, title: 'Semua perlawanan lengkap',
                subtitle: 'Tiada slot wajib yang kosong untuk 14 hari akan datang.'),
          for (final m in items) GapCard(match: m, onDone: () => _view.currentState?.reload()),
        ]),
      ),
    );
  }
}

/// One incomplete match; opens LantikScreen and calls [onDone] on return.
class GapCard extends StatelessWidget {
  const GapCard({super.key, required this.match, this.onDone});
  final Map<String, dynamic> match;
  final VoidCallback? onDone;

  @override
  Widget build(BuildContext context) {
    final m = match;
    final empty = [for (final s in (m['slot_kosong'] as List? ?? [])) '$s'];
    final declined = int.tryParse('${m['jumlah_ditolak'] ?? 0}') ?? 0;
    final kickoff = DateTime.tryParse('${'${m['tarikh']}'.padRight(10).substring(0, 10)}T${formatTime(m['masa'])}:00+08:00');
    final hours = kickoff?.difference(DateTime.now()).inHours;
    final urgent = hours != null && hours < 48;
    return AppCard(
      accent: urgent ? Tw.rose500 : Tw.pahangYellow,
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LantikScreen(match: m)));
        onDone?.call();
      },
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DateBlock(m['tarikh'], highlight: urgent),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${formatTime(m['masa'])} · ${text(m['nama_kejohanan'])}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted)),
            Text('${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              for (final s in empty)
                Pill('Tiada ${s.replaceAll('Penolong Pengadil ', 'AR')}', (Tw.rose50, Tw.rose700), icon: Icons.person_off_outlined),
              if (declined > 0) Pill('$declined ditolak', (Tw.amber50, Tw.amber700)),
              if (urgent) Pill(hours <= 0 ? 'Hari ini' : '$hours jam lagi', (Tw.red100, Tw.red700), icon: Icons.timer_outlined),
            ]),
          ]),
        ),
        const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
      ]),
    );
  }
}

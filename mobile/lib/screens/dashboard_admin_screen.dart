import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'permohonan_screen.dart' show formLabel;

/// Admin summary from /api/admin-dashboard-stats.php, with shortcuts to the
/// app's approval and appointment tabs.
class DashboardAdminScreen extends StatelessWidget {
  const DashboardAdminScreen({super.key, required this.onOpenTab});
  final void Function(String tabId) onOpenTab;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      loadingMessage: 'Memuatkan dashboard...',
      load: () async => Map<String, dynamic>.from((await Api.instance.get('/api/admin-dashboard-stats.php'))['stats'] as Map),
      builder: (context, s, reload) {
        final byType = Map<String, dynamic>.from(s['applications_by_type'] as Map? ?? {});
        final pendingTypes = byType.entries
            .map((e) => (e.key, Map<String, dynamic>.from(e.value as Map)))
            .where((e) => (int.tryParse('${e.$2['pending']}') ?? 0) > 0)
            .toList();
        Widget stat(IconData icon, Color bg, Color fg, Object? value, String label, {VoidCallback? onTap}) => Expanded(
              child: WebCard(
                margin: EdgeInsets.zero,
                borderColor: Colors.transparent,
                onTap: onTap,
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
                    child: Icon(icon, color: fg, size: 22),
                  ),
                  const SizedBox(height: 12),
                  Text('${value ?? 0}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                  Text(label, style: const TextStyle(fontSize: 12, color: Tw.gray500)),
                ]),
              ),
            );
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              stat(Icons.sports, Tw.blue100, Tw.blue600, s['total_pengadil'], 'Pengadil aktif'),
              const SizedBox(width: 12),
              stat(Icons.pending_actions, Tw.yellow100, Tw.yellow600, s['pending_applications'],
                  'Permohonan menunggu ${text(s['year'], '')}', onTap: () => onOpenTab('kelulusan')),
            ])),
            const SizedBox(height: 12),
            IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              stat(Icons.rate_review_outlined, Tw.purple100, Tw.purple600, s['pending_reports'], 'Laporan RA menunggu'),
              const SizedBox(width: 12),
              stat(Icons.sports_soccer, Tw.green100, Tw.green600, s['matches_this_month'], 'Perlawanan bulan ini'),
            ])),
            const SizedBox(height: 16),
            WebCard(
              padding: EdgeInsets.zero,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Tw.slate100))),
                  child: const CardTitle('Permohonan Menunggu', icon: Icons.description_outlined),
                ),
                if (pendingTypes.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: Text('Tiada permohonan menunggu.', style: TextStyle(color: Tw.slate400, fontSize: 14))),
                  ),
                for (final (key, count) in pendingTypes)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    decoration: const BoxDecoration(border: Border(top: BorderSide(color: Tw.slate100))),
                    child: Row(children: [
                      Expanded(child: Text(formLabel(key), style: const TextStyle(fontSize: 14, color: Tw.slate700))),
                      StatusBadge('${count['pending']} menunggu', (Tw.yellow100, Tw.yellow700), pill: true),
                    ]),
                  ),
              ]),
            ),
            Row(children: [
              Expanded(
                child: YellowButton(label: 'Kelulusan', icon: Icons.task_alt, expand: true, onPressed: () => onOpenTab('kelulusan')),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlineButton(label: 'Lantikan', icon: Icons.event_note_outlined, expand: true,
                    onPressed: () => onOpenTab('lantikan')),
              ),
            ]),
          ]),
        );
      },
    );
  }
}

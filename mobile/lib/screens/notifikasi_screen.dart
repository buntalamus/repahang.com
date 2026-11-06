import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'pengumuman_screen.dart';

/// In-app notices (/api/notifications.php), the same list pushes come from.
class NotifikasiScreen extends StatefulWidget {
  const NotifikasiScreen({super.key});

  @override
  State<NotifikasiScreen> createState() => _NotifikasiScreenState();
}

class _NotifikasiScreenState extends State<NotifikasiScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();

  static String _plain(String html) => html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]*>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"');

  static (IconData, Color) _icon(String type) {
    final t = type.toLowerCase();
    if (t.contains('lantikan') || t.contains('perlawanan baru') || t.contains('status perlawanan')) {
      return (Icons.event_note_rounded, Tw.blue600);
    }
    if (t.contains('tolak') || t.contains('batal')) return (Icons.cancel_rounded, Tw.rose600);
    if (t.contains('permohonan') || t.contains('pp disahkan') || t.contains('keputusan') || t.contains('pendaftaran')) {
      return (Icons.description_rounded, Tw.amber600);
    }
    if (t.contains('pengesahan') || t.contains('rekod') || t.contains('laporan')) return (Icons.fact_check_rounded, Tw.emerald600);
    return (Icons.notifications_rounded, Tw.slate500);
  }

  Future<void> _markAll() async {
    try {
      await Api.instance.post('/api/notifications.php', {'action': 'mark_all_read'});
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  void _open(Map<String, dynamic> n) {
    final announcementId = int.tryParse('${n['announcement_id']}');
    if (announcementId != null && announcementId > 0) {
      openAnnouncement(context, announcementId).then((_) {
        if (mounted) _view.currentState?.reload();
      });
      return;
    }
    if ('${n['is_read']}' != '1') {
      Api.instance.post('/api/notifications.php', {'action': 'mark_read', 'notification_id': n['id']}).then(
          (_) => mounted ? setState(() => n['is_read'] = 1) : null,
          onError: (_) {});
    }
    showAppSheet<void>(context, builder: (context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(text(n['subject']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 6),
      Text('${text(n['type'])} · ${text(n['created_at'])}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
      const Divider(height: 28),
      Text(_plain(text(n['message'], '')), style: const TextStyle(fontSize: 15, height: 1.6)),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifikasi'),
        actions: [
          TextButton(onPressed: _markAll, child: const Text('Tandai dibaca')),
          const SizedBox(width: 8),
        ],
      ),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        load: () => Api.instance.get('/api/notifications.php'),
        builder: (context, body, reload) {
          final items = (body['notifications'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          return RefreshList(onRefresh: reload, children: [
            if (items.isEmpty) const EmptyState(icon: Icons.notifications_off_outlined, title: 'Tiada notifikasi'),
            if (items.isNotEmpty)
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (var i = 0; i < items.length; i++) ...[
                    if (i > 0) const Divider(indent: 72),
                    _tile(items[i]),
                  ],
                ]),
              ),
          ]);
        },
      ),
    );
  }

  Widget _tile(Map<String, dynamic> n) {
    final unread = '${n['is_read']}' != '1';
    final (icon, color) = _icon(text(n['type'], ''));
    return ListTile(
      onTap: () => _open(n),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: CircleAvatar(backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, color: color, size: 22)),
      title: Text(text(n['subject']), maxLines: 2, overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 14, fontWeight: unread ? FontWeight.w700 : FontWeight.w500)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text('${_plain(text(n['message'], ''))}\n${text(n['created_at'])}', maxLines: 3, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: AppColors.muted, height: 1.4)),
      ),
      trailing: unread
          ? Container(width: 10, height: 10, decoration: const BoxDecoration(color: Tw.blue600, shape: BoxShape.circle))
          : null,
    );
  }
}

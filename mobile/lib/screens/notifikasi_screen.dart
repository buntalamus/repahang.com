import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// In-app notices, styled like the website header's notification panel.
class NotifikasiScreen extends StatefulWidget {
  const NotifikasiScreen({super.key});

  @override
  State<NotifikasiScreen> createState() => _NotifikasiScreenState();
}

class _NotifikasiScreenState extends State<NotifikasiScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();

  Future<void> _markAll() async {
    try {
      await Api.instance.post('/api/notifications.php', {'action': 'mark_all_read'});
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
    await _view.currentState?.reload();
  }

  void _open(Map<String, dynamic> n) {
    if ('${n['is_read']}' != '1') {
      Api.instance.post('/api/notifications.php', {'action': 'mark_read', 'notification_id': n['id']}).then(
          (_) => mounted ? setState(() => n['is_read'] = 1) : null,
          onError: (_) {});
    }
    showWebModal<void>(
      context,
      title: text(n['subject'] ?? n['title'], 'Notifikasi'),
      body: (_) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(text(n['created_at']), style: const TextStyle(fontSize: 12, color: Tw.slate600)),
        const SizedBox(height: 12),
        Text(_plain(text(n['message'], '')), style: const TextStyle(fontSize: 14, color: Tw.slate800, height: 1.5)),
      ]),
    );
  }

  static String _plain(String html) => html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]*>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        loadingMessage: 'Memuatkan notifikasi...',
        load: () => Api.instance.get('/api/notifications.php'),
        builder: (context, body, reload) {
          final items = (body['notifications'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          final unread = int.tryParse('${body['unread_count']}') ?? 0;
          return RefreshIndicator(
            color: Tw.pahangBlack,
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              WebCard(
                padding: EdgeInsets.zero,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Tw.slate50,
                      border: Border(bottom: BorderSide(color: Tw.slate200)),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                    ),
                    child: Row(children: [
                      const Expanded(
                        child: Text('Notifikasi', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      ),
                      if (unread > 0)
                        GestureDetector(
                          onTap: _markAll,
                          child: const Text('Tandai semua dibaca',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Tw.slate700)),
                        ),
                    ]),
                  ),
                  if (items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: Text('Tiada notifikasi.', style: TextStyle(fontSize: 14, color: Tw.slate600))),
                    ),
                  for (var i = 0; i < items.length; i++) _item(i, items[i], i == items.length - 1),
                ]),
              ),
            ]),
          );
        },
      ),
    );
  }

  Widget _item(int index, Map<String, dynamic> n, bool last) {
    final unread = '${n['is_read']}' != '1';
    return Material(
      color: unread ? Tw.blue50 : Colors.white,
      borderRadius: last ? const BorderRadius.vertical(bottom: Radius.circular(12)) : null,
      child: InkWell(
        onTap: () => _open(n),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: Tw.slate200))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text(n['subject'] ?? n['title'] ?? n['message']),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Tw.slate800)),
            const SizedBox(height: 4),
            Text(_plain(text(n['message'], '')), maxLines: 3, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Tw.slate600)),
            const SizedBox(height: 4),
            Text(text(n['created_at']), style: const TextStyle(fontSize: 12, color: Tw.slate600)),
          ]),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

Future<void> openAnnouncement(BuildContext context, int id) => Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(id: id)),
    );

class AnnouncementTile extends StatelessWidget {
  const AnnouncementTile({super.key, required this.item, required this.onTap});
  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        onTap: onTap,
        leading: const Icon(Icons.campaign_outlined, color: AppColors.black),
        title: Text(text(item['title']), maxLines: 2, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SizedBox(height: 4),
          Text(formatDate(item['created_at']), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: 4),
          Text(text(item['content'], ''), maxLines: 2, overflow: TextOverflow.ellipsis),
        ]),
        trailing: '${item['is_read']}' != '1'
            ? const Pill('Baharu', (Tw.pahangYellow, AppColors.black))
            : const Icon(Icons.chevron_right_rounded),
      );
}

class PengumumanScreen extends StatelessWidget {
  const PengumumanScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Pengumuman')),
        body: AsyncView<Map<String, dynamic>>(
          load: () => Api.instance.get('/api/announcements.php'),
          builder: (context, body, reload) {
            final items = (body['announcements'] as List? ?? []).cast<Map>();
            return RefreshList(onRefresh: reload, children: [
              if (items.isEmpty) const EmptyState(icon: Icons.campaign_outlined, title: 'Tiada pengumuman'),
              for (final item in items)
                AppCard(padding: EdgeInsets.zero, child: AnnouncementTile(
                  item: Map<String, dynamic>.from(item),
                  onTap: () async {
                    await openAnnouncement(context, int.parse('${item['id']}'));
                    if (context.mounted) await reload();
                  },
                )),
            ]);
          },
        ),
      );
}

class AnnouncementDetailScreen extends StatefulWidget {
  const AnnouncementDetailScreen({super.key, required this.id});
  final int id;

  @override
  State<AnnouncementDetailScreen> createState() => _AnnouncementDetailScreenState();
}

class _AnnouncementDetailScreenState extends State<AnnouncementDetailScreen> {
  bool _read = false;
  bool _marking = false;
  bool _readFailed = false;

  Future<void> _markRead() async {
    if (_read || _marking) return;
    _marking = true;
    try {
      await Api.instance.post('/api/announcement-read.php', {'announcement_id': widget.id});
      if (mounted) setState(() { _read = true; _readFailed = false; });
    } catch (_) {
      if (mounted) setState(() => _readFailed = true);
    } finally { _marking = false; }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Pengumuman')),
        body: AsyncView<Map<String, dynamic>>(
          load: () => Api.instance.get('/api/announcements.php', {'id': widget.id}),
          builder: (context, body, reload) {
            final item = Map<String, dynamic>.from(body['announcement'] as Map);
            if (!_read && !_readFailed) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) _markRead();
              });
            }
            return RefreshList(onRefresh: reload, children: [
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(text(item['title']), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(formatDate(item['created_at']), style: const TextStyle(color: AppColors.muted)),
                const Divider(height: 32),
                SelectableText(text(item['content'], ''), style: const TextStyle(fontSize: 16, height: 1.6)),
                if (_readFailed) TextButton(onPressed: _markRead,
                    child: const Text('Status bacaan belum disimpan. Cuba lagi')),
              ])),
            ]);
          },
        ),
      );
}

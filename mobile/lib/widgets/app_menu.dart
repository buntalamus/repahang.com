import 'package:flutter/material.dart';

import '../api.dart';
import '../navigation.dart';
import '../theme.dart';
import 'common.dart';

/// Full-page grid of every menu entry ("Lihat semua" on the home screen).
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key, required this.user, required this.onOpen, this.embedded = false,
      this.badges = const {}});
  final SessionUser user;
  final Future<void> Function(MenuEntry entry) onOpen;

  /// Pending counts keyed by shell page id.
  final Map<String?, int> badges;

  /// Shown as a shell tab (the shell supplies the app bar).
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final body = ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
        for (final section in menuFor(user)) ...[
          SectionTitle(section.title),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.88,
            children: [
              for (final entry in section.entries)
                MenuTile(
                  label: entry.label,
                  icon: entry.icon,
                  external: entry.external,
                  badge: badges[entry.page],
                  onTap: () {
                    // Shell pages are shown by the shell, so leave this screen first.
                    if (entry.page != null && !embedded) Navigator.pop(context);
                    onOpen(entry);
                  },
                ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        const Row(children: [
          Icon(Icons.open_in_new_rounded, size: 14, color: AppColors.faint),
          SizedBox(width: 6),
          Expanded(
            child: Text('Dibuka di website buat masa ini.', style: TextStyle(fontSize: 12, color: AppColors.muted)),
          ),
        ]),
      ]);
    if (embedded) return body;
    return Scaffold(appBar: AppBar(title: const Text('Semua Menu')), body: body);
  }
}

import 'package:flutter/material.dart';

import '../api.dart';
import '../navigation.dart';
import '../theme.dart';
import 'common.dart';

/// Side menu (☰) with every page for the user's role.
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key, required this.user, required this.onOpen});
  final SessionUser user;
  final Future<void> Function(MenuEntry entry) onOpen;

  @override
  Widget build(BuildContext context) {
    final sections = menuFor(user);
    return Drawer(
      child: Column(children: [
        Container(
          width: double.infinity,
          color: AppColors.black,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Tw.pahangYellow, shape: BoxShape.circle),
                  child: Avatar(name: user.name, radius: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(user.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(user.role, style: const TextStyle(color: Tw.pahangYellow, fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(12, 8, 12, 24), children: [
            for (final section in sections) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 16, 12, 6),
                child: Text(section.title.toUpperCase(),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.faint, letterSpacing: 0.8)),
              ),
              for (final entry in section.entries)
                ListTile(
                  dense: true,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  leading: Icon(entry.icon, size: 22, color: AppColors.charcoal),
                  title: Text(entry.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  trailing: entry.external
                      ? const Icon(Icons.open_in_new_rounded, size: 16, color: AppColors.faint)
                      : null,
                  onTap: () {
                    Navigator.pop(context);
                    onOpen(entry);
                  },
                ),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// Full-page grid of every menu entry ("Lihat semua" on the home screen).
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key, required this.user, required this.onOpen, this.embedded = false});
  final SessionUser user;
  final Future<void> Function(MenuEntry entry) onOpen;

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
            childAspectRatio: 0.82,
            children: [
              for (final entry in section.entries)
                MenuTile(
                  label: entry.label,
                  icon: entry.icon,
                  external: entry.external,
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

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../config.dart';
import '../theme.dart';

const _monthsMs = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const _daysMs = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

DateTime? parseDate(Object? raw) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch('${raw ?? ''}');
  return match == null ? null : DateTime(int.parse(match[1]!), int.parse(match[2]!), int.parse(match[3]!));
}

/// "2026-10-18" → "18 Okt 2026".
String formatDate(Object? raw) {
  final date = parseDate(raw);
  if (date == null) return text(raw);
  return '${date.day} ${_monthsMs[date.month - 1]} ${date.year}';
}

/// "2026-10-18" → "Ahad, 18 Okt".
String formatDayDate(Object? raw) {
  final date = parseDate(raw);
  if (date == null) return text(raw);
  return '${_daysMs[date.weekday - 1]}, ${date.day} ${_monthsMs[date.month - 1]}';
}

String monthShort(int month) => _monthsMs[month - 1];

/// "20:30:00" → "20:30".
String formatTime(Object? raw) {
  final value = '${raw ?? ''}';
  return value.length >= 5 ? value.substring(0, 5) : (value.isEmpty ? '-' : value);
}

/// Kuala Lumpur wall-clock text for a UTC instant: "18 Okt 2026, 20:30".
String formatKl(DateTime utc) {
  final kl = utc.toUtc().add(const Duration(hours: 8));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${kl.day} ${_monthsMs[kl.month - 1]} ${kl.year}, ${two(kl.hour)}:${two(kl.minute)}';
}

String text(Object? value, [String fallback = '-']) {
  final result = '${value ?? ''}'.trim();
  return result.isEmpty ? fallback : result;
}

String greeting() {
  final hour = DateTime.now().toUtc().add(const Duration(hours: 8)).hour;
  if (hour < 12) return 'Selamat pagi';
  if (hour < 15) return 'Selamat tengah hari';
  if (hour < 19) return 'Selamat petang';
  return 'Selamat malam';
}

Future<void> openWebsite(BuildContext context, [String path = '/']) async {
  final ok = await launchUrl(Uri.parse('$apiBase$path'), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showToast(context, 'Tidak dapat membuka pelayar.', ToastType.error);
}

/// Opens the phone dialer with the number filled in.
Future<void> callNumber(BuildContext context, String number) async {
  final digits = number.replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.isEmpty) return;
  final ok = await launchUrl(Uri(scheme: 'tel', path: digits));
  if (!ok && context.mounted) showToast(context, 'Tidak dapat membuka panggilan telefon.', ToastType.error);
}

enum ToastType { success, error, warning, info }

void showToast(BuildContext context, String message, [ToastType type = ToastType.success]) {
  final (icon, color) = switch (type) {
    ToastType.success => (Icons.check_circle, Tw.emerald500),
    ToastType.error => (Icons.error, Tw.rose500),
    ToastType.warning => (Icons.warning_amber_rounded, Tw.pahangYellow),
    ToastType.info => (Icons.info, Tw.sky500),
  };
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    content: Row(children: [
      Icon(icon, color: color, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Text(message)),
    ]),
  ));
}

/// Background/foreground pairs for status pills (same meanings as the website).
typedef Tone = (Color bg, Color fg);

Tone appointmentTone(String status) => switch (status) {
      'Diterima' => (Tw.emerald50, Tw.emerald700),
      'Ditolak' => (Tw.rose50, Tw.rose700),
      'Dibatalkan' => (Tw.red50, Tw.red700),
      'Ditangguhkan' => (Tw.orange50, Tw.orange700),
      _ => (Tw.amber50, Tw.amber700),
    };

Tone matchTone(String status) => switch (status) {
      'Disahkan' => (Tw.green100, Tw.green700),
      'Tidak Disahkan' || 'Ditolak' => (Tw.red100, Tw.red700),
      _ => (Tw.yellow100, Tw.yellow700),
    };

Tone applicationTone(String status) => switch (status) {
      'Lengkap' || 'Bayaran Diterima' || 'Approved' => (Tw.green100, Tw.green700),
      'Ditolak' || 'Rejected' => (Tw.red100, Tw.red700),
      'Menunggu PP Daerah' || 'Menunggu Admin' || 'Menunggu Bayaran' || 'PP Daerah Disahkan' || 'Pending' ||
      'Admin Diluluskan' =>
        (Tw.yellow100, Tw.yellow700),
      _ => (Tw.gray100, Tw.gray600),
    };

Tone tournamentTone(String jenis) => switch (jenis) {
      'Liga' => (Tw.blue50, Tw.blue700),
      'Karnival' => (Tw.purple50, Tw.purple700),
      _ => (Tw.slate100, Tw.slate600),
    };

/// Rounded status pill.
class Pill extends StatelessWidget {
  const Pill(this.label, this.tone, {super.key, this.icon});
  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: tone.$2), const SizedBox(width: 4)],
        Flexible(
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: tone.$2, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
      ]),
    );
  }
}

/// White rounded card with a soft shadow, the app's basic surface.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16),
      this.margin = const EdgeInsets.only(bottom: 12), this.color = Colors.white, this.accent});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color color;

  /// Coloured strip on the left edge, used to flag items that need action.
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    Widget body = Padding(padding: padding, child: child);
    if (accent != null) {
      body = IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 4, color: accent),
          Expanded(child: body),
        ]),
      );
    }
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(color: Colors.transparent, child: InkWell(onTap: onTap, child: body)),
    );
  }
}

/// Calendar-style day block: big day number over the short month.
class DateBlock extends StatelessWidget {
  const DateBlock(this.raw, {super.key, this.highlight = false});
  final Object? raw;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final date = parseDate(raw);
    return Container(
      width: 54,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: highlight ? Tw.pahangYellow : AppColors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(date == null ? '-' : '${date.day}',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.black, height: 1.1)),
        Text(date == null ? '' : monthShort(date.month).toUpperCase(),
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.black, letterSpacing: 0.5)),
      ]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
      child: Row(children: [
        Expanded(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
        if (action != null)
          GestureDetector(
            onTap: onAction,
            child: Text(action!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Tw.blue700)),
          ),
      ]),
    );
  }
}

/// Number tile for summaries.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, required this.icon, this.color = AppColors.black,
      this.onTap, this.selected = false});
  final String label;
  final Object? value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: EdgeInsets.zero,
      onTap: onTap,
      color: selected ? AppColors.black : Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(color: color.withValues(alpha: selected ? 0.25 : 0.12), shape: BoxShape.circle),
          child: Icon(icon, size: 18, color: selected ? Tw.pahangYellow : color),
        ),
        const SizedBox(height: 10),
        Text('${value ?? 0}',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: selected ? Colors.white : AppColors.text)),
        Text(label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: selected ? Colors.white70 : AppColors.muted)),
      ]),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.subtitle, this.actionLabel, this.onAction});
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
          child: Icon(icon, size: 36, color: AppColors.faint),
        ),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(subtitle!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
        ],
        if (actionLabel != null) ...[
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ]),
    );
  }
}

class Loading extends StatelessWidget {
  const Loading({super.key});

  @override
  Widget build(BuildContext context) =>
      const Center(child: Padding(padding: EdgeInsets.all(48), child: CircularProgressIndicator(strokeWidth: 3)));
}

/// Loads [load] and shows a spinner, an error with retry, or [builder]'s content
/// (keeping the previous content on screen while refreshing).
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;

  @override
  State<AsyncView<T>> createState() => AsyncViewState<T>();
}

class AsyncViewState<T> extends State<AsyncView<T>> {
  late Future<T> _future = widget.load();
  T? _last;

  Future<void> reload() async {
    final future = widget.load();
    setState(() {
      _future = future;
    });
    try {
      await future;
    } catch (_) {
      // Shown by the FutureBuilder.
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasData) _last = snapshot.data;
        if (snapshot.connectionState != ConnectionState.done && _last == null) return const Loading();
        if (snapshot.hasError && snapshot.connectionState == ConnectionState.done) {
          return ListView(shrinkWrap: true, children: [
            EmptyState(icon: Icons.cloud_off_rounded, title: 'Tidak dapat dimuatkan', subtitle: '${snapshot.error}',
                actionLabel: 'Cuba semula', onAction: reload),
          ]);
        }
        return widget.builder(context, (snapshot.data ?? _last) as T, reload);
      },
    );
  }
}

/// Pull-to-refresh list with the app's page padding.
class RefreshList extends StatelessWidget {
  const RefreshList({super.key, required this.onRefresh, required this.children, this.bottomPadding = 24});
  final Future<void> Function() onRefresh;
  final List<Widget> children;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.black,
      backgroundColor: Tw.pahangYellow,
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 8, 16, bottomPadding),
        children: children,
      ),
    );
  }
}

/// Horizontal filter chips.
class FilterChips<T> extends StatelessWidget {
  const FilterChips({super.key, required this.options, required this.value, required this.onChanged});
  final List<(T, String)> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        for (final (v, label) in options)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(label),
              selected: v == value,
              showCheckmark: false,
              labelStyle: TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 13, color: v == value ? Tw.pahangYellow : AppColors.text),
              onSelected: (_) => onChanged(v),
            ),
          ),
      ]),
    );
  }
}

/// Icon + label + value row for detail sheets.
class DetailRow extends StatelessWidget {
  const DetailRow(this.icon, this.label, this.value, {super.key, this.onTap, this.trailing});
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Icon(icon, size: 20, color: AppColors.muted),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
            ]),
          ),
          ?trailing,
        ]),
      ),
    );
  }
}

/// Bottom sheet with a title and scrollable body that rises with the keyboard.
Future<T?> showAppSheet<T>(BuildContext context, {String? title, required Widget Function(BuildContext) builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            if (title != null) ...[
              Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
            ],
            builder(context),
          ]),
        ),
      ),
    ),
  );
}

/// Yes/no question as a bottom sheet; the confirm button takes [color].
Future<bool> confirmSheet(BuildContext context, {required String title, required String message,
    required String confirmLabel, Color color = AppColors.black, Color textColor = Tw.pahangYellow}) async {
  final ok = await showAppSheet<bool>(context, title: title, builder: (context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(message, style: const TextStyle(fontSize: 15, color: Tw.slate600, height: 1.5)),
      const SizedBox(height: 24),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: textColor),
        onPressed: () => Navigator.pop(context, true),
        child: Text(confirmLabel),
      ),
      const SizedBox(height: 8),
      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
    ],
  ));
  return ok == true;
}

/// Round avatar for a private profile photo, falling back to initials.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.photo, this.radius = 24, this.version = 0});
  final String name;
  final String? photo;
  final double radius;
  final int version;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty && w != 'BIN' && w != 'BINTI')
        .take(2).map((w) => w[0]).join().toUpperCase();
    final url = text(photo, '');
    return CircleAvatar(
      radius: radius,
      backgroundColor: Tw.pahangYellow,
      foregroundImage: url.isEmpty
          ? null
          : NetworkImage('${Api.instance.absoluteUrl(url)}${url.contains('?') ? '&' : '?'}v=$version',
              headers: Api.instance.imageHeaders),
      child: Text(initials.isEmpty ? '?' : initials,
          style: TextStyle(fontSize: radius * 0.7, fontWeight: FontWeight.w800, color: AppColors.black)),
    );
  }
}

/// Text field with a label above, for forms in sheets and pages.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, this.controller, this.hint, this.maxLines = 1,
      this.obscure = false, this.keyboardType, this.required = false});
  final String label;
  final TextEditingController? controller;
  final String? hint;
  final int maxLines;
  final bool obscure;
  final TextInputType? keyboardType;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text.rich(TextSpan(children: [
          TextSpan(text: label),
          if (required) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
        ]), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.slate700)),
        const SizedBox(height: 6),
        TextField(controller: controller, maxLines: maxLines, obscureText: obscure, keyboardType: keyboardType,
            decoration: InputDecoration(hintText: hint)),
      ]),
    );
  }
}

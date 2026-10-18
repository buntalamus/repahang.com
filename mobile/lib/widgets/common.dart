import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../theme.dart';

const _monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _monthsMs = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

/// Angular `date:'d MMM y'` as the website shows it: "2026-10-18" → "18 Oct 2026".
String formatDate(Object? raw) {
  final value = '${raw ?? ''}';
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);
  if (match == null) return value.isEmpty ? '-' : value;
  return '${int.parse(match[3]!)} ${_monthsEn[int.parse(match[2]!) - 1]} ${match[1]}';
}

/// "20:30:00" → "20:30".
String formatTime(Object? raw) {
  final value = '${raw ?? ''}';
  return value.length >= 5 ? value.substring(0, 5) : (value.isEmpty ? '-' : value);
}

/// Kuala Lumpur wall-clock text for a UTC instant, like Intl ms-MY: "18 Okt 2026, 20:30".
String formatKl(DateTime utc) {
  final kl = utc.toUtc().add(const Duration(hours: 8));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(kl.day)} ${_monthsMs[kl.month - 1]} ${kl.year}, ${two(kl.hour)}:${two(kl.minute)}';
}

String text(Object? value, [String fallback = '-']) {
  final result = '${value ?? ''}'.trim();
  return result.isEmpty ? fallback : result;
}

Future<void> openWebsite(BuildContext context, [String path = '/']) async {
  final ok = await launchUrl(Uri.parse('$apiBase$path'), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showToast(context, 'Tidak dapat membuka pelayar.', ToastType.error);
}

/// Opens the phone dialer with the number filled in (no call is placed without the user).
Future<void> callNumber(BuildContext context, String number) async {
  final digits = number.replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.isEmpty) return;
  final ok = await launchUrl(Uri(scheme: 'tel', path: digits));
  if (!ok && context.mounted) showToast(context, 'Tidak dapat membuka panggilan telefon.', ToastType.error);
}

enum ToastType { success, error, warning, info }

/// The website's toast: a rounded gradient pill with white text.
void showToast(BuildContext context, String message, [ToastType type = ToastType.success]) {
  final colors = switch (type) {
    ToastType.success => [Tw.emerald600, Tw.emerald500],
    ToastType.error => [Tw.rose600, Tw.rose500],
    ToastType.warning => [Tw.amber600, const Color(0xFFF59E0B)],
    ToastType.info => [Tw.sky600, Tw.sky500],
  };
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    backgroundColor: Colors.transparent,
    elevation: 0,
    padding: EdgeInsets.zero,
    content: Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: colors),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Text(message, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
    ),
  ));
}

/// Background/foreground pairs the website uses for status pills.
typedef Tone = (Color bg, Color fg);

/// tugasan.component getStatusClass().
Tone appointmentTone(String status) => switch (status) {
      'Diterima' => (Tw.emerald50, Tw.emerald700),
      'Ditolak' => (Tw.rose50, Tw.rose700),
      'Dibatalkan' => (Tw.red50, Tw.red700),
      'Ditangguhkan' => (Tw.orange50, Tw.orange700),
      _ => (Tw.amber50, Tw.amber700),
    };

/// matches.component statusClass().
Tone matchTone(String status) => switch (status) {
      'Disahkan' => (Tw.green100, Tw.green700),
      'Tidak Disahkan' => (Tw.red100, Tw.red700),
      _ => (Tw.yellow100, Tw.yellow700),
    };

/// application.component statusClass().
Tone applicationTone(String status) => switch (status) {
      'Lengkap' || 'Bayaran Diterima' || 'Approved' => (Tw.green100, Tw.green700),
      'Ditolak' || 'Rejected' => (Tw.red100, Tw.red700),
      'Menunggu PP Daerah' || 'Menunggu Admin' || 'Menunggu Bayaran' || 'PP Daerah Disahkan' || 'Pending' ||
      'Admin Diluluskan' =>
        (Tw.yellow100, Tw.yellow700),
      'Draf' => (Tw.gray100, Tw.gray600),
      _ => (Tw.gray100, Tw.gray700),
    };

/// Tournament type tag (Liga / Karnival / Persahabatan) as on the tugasan page.
Tone tournamentTone(String jenis) => switch (jenis) {
      'Liga' => (Tw.blue100, Tw.blue700),
      'Karnival' => (Tw.purple100, Tw.purple700),
      _ => (Tw.slate100, Tw.slate500),
    };

/// `px-2 py-0.5 rounded text-xs font-medium` status pill; [pill] uses rounded-full.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, this.tone, {super.key, this.pill = false, this.small = false});
  final String label;
  final Tone tone;
  final bool pill;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 4 : 8, vertical: small ? 1 : 2),
      decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(pill ? 999 : 4)),
      child: Text(label,
          style: TextStyle(
              color: tone.$2, fontSize: small ? 9 : 12, fontWeight: small || pill ? FontWeight.w600 : FontWeight.w500)),
    );
  }
}

/// `bg-white rounded-xl shadow-sm border border-slate-200`.
class WebCard extends StatelessWidget {
  const WebCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.borderColor = Tw.slate200,
      this.onTap, this.margin = const EdgeInsets.only(bottom: 12), this.color = Colors.white});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color borderColor;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Padding(padding: padding, child: child);
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
        boxShadow: Tw.shadowSm,
      ),
      child: onTap == null
          ? body
          : Material(
              color: Colors.transparent,
              child: InkWell(borderRadius: BorderRadius.circular(12), onTap: onTap, child: body),
            ),
    );
  }
}

/// app-loading: a yellow spinner with a slate-500 caption.
class Loading extends StatelessWidget {
  const Loading({super.key, this.message = ''});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(width: 32, height: 32, child: CircularProgressIndicator(strokeWidth: 2.5, color: Tw.pahangYellow)),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(message, style: const TextStyle(fontSize: 14, color: Tw.slate500)),
          ],
        ]),
      ),
    );
  }
}

/// Empty or error state inside a white card, like the website's "Tiada …" rows.
class EmptyCard extends StatelessWidget {
  const EmptyCard({super.key, required this.icon, required this.message, this.actionLabel, this.onAction});
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return WebCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Center(
        child: Column(children: [
          Icon(icon, size: 40, color: Tw.slate300),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Tw.slate400, fontSize: 14)),
          if (actionLabel != null) ...[
            const SizedBox(height: 16),
            OutlineButton(label: actionLabel!, onPressed: onAction),
          ],
        ]),
      ),
    );
  }
}

/// Loads [load] and shows [Loading], an [EmptyCard] with retry, or [builder]'s content.
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.loadingMessage = ''});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  final String loadingMessage;

  @override
  State<AsyncView<T>> createState() => AsyncViewState<T>();
}

class AsyncViewState<T> extends State<AsyncView<T>> {
  late Future<T> _future = widget.load();
  T? _last;

  Future<void> reload() async {
    final future = widget.load();
    setState(() => _future = future);
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
        // Keep the current list on screen while a refresh is running.
        if (snapshot.connectionState != ConnectionState.done && _last == null) return Loading(message: widget.loadingMessage);
        if (snapshot.hasError && snapshot.connectionState == ConnectionState.done) {
          // shrinkWrap also lets this sit inside a modal's scroll view.
          return ListView(shrinkWrap: true, padding: const EdgeInsets.all(16), children: [
            EmptyCard(icon: Icons.cloud_off, message: '${snapshot.error}', actionLabel: 'Cuba semula', onAction: reload),
          ]);
        }
        return widget.builder(context, (snapshot.data ?? _last) as T, reload);
      },
    );
  }
}

/// `bg-pahang-yellow text-pahang-black font-semibold rounded-lg`.
class YellowButton extends StatelessWidget {
  const YellowButton({super.key, required this.label, this.onPressed, this.icon, this.expand = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) => _WebButton(
      label: label, icon: icon, onPressed: onPressed, expand: expand, bg: Tw.pahangYellow, fg: Tw.pahangBlack);
}

/// `bg-pahang-black text-pahang-yellow font-bold rounded-lg` (login button).
class BlackButton extends StatelessWidget {
  const BlackButton({super.key, required this.label, this.onPressed, this.busy = false});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) => _WebButton(
      label: label, onPressed: busy ? null : onPressed, expand: true, bg: Tw.pahangBlack, fg: Tw.pahangYellow,
      bold: true, height: 48, busy: busy);
}

/// Solid colour button such as `bg-emerald-600 text-white`.
class SolidButton extends StatelessWidget {
  const SolidButton({super.key, required this.label, required this.color, this.onPressed, this.expand = false, this.busy = false});
  final String label;
  final Color color;
  final VoidCallback? onPressed;
  final bool expand;
  final bool busy;

  @override
  Widget build(BuildContext context) =>
      _WebButton(label: label, onPressed: busy ? null : onPressed, expand: expand, bg: color, fg: Colors.white, busy: busy);
}

/// `border border-slate-300 text-slate-600 rounded-lg` (or a custom border colour).
class OutlineButton extends StatelessWidget {
  const OutlineButton({super.key, required this.label, this.onPressed, this.border = Tw.slate300, this.fg = Tw.slate600,
      this.expand = false, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final Color border;
  final Color fg;
  final bool expand;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => _WebButton(
      label: label, onPressed: onPressed, expand: expand, bg: Colors.white, fg: fg, border: border, icon: icon);
}

class _WebButton extends StatelessWidget {
  const _WebButton({required this.label, required this.onPressed, required this.bg, required this.fg, this.border,
      this.icon, this.expand = false, this.bold = false, this.height = 40, this.busy = false});
  final String label;
  final VoidCallback? onPressed;
  final Color bg;
  final Color fg;
  final Color? border;
  final IconData? icon;
  final bool expand;
  final bool bold;
  final double height;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final child = Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
      if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 8)],
      Flexible(
        child: Text(label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: fg, fontSize: 14, fontWeight: bold ? FontWeight.w700 : FontWeight.w600)),
      ),
      if (busy) ...[
        const SizedBox(width: 12),
        SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: fg)),
      ],
    ]);
    return Opacity(
      opacity: onPressed == null && !busy ? 0.6 : 1,
      child: SizedBox(
        height: height,
        width: expand ? double.infinity : null,
        child: Material(
          color: bg,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8), side: border == null ? BorderSide.none : BorderSide(color: border!)),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              // widthFactor keeps a non-expanded button as wide as its label.
              child: Align(widthFactor: expand ? null : 1, child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// A grey label over a value, as in the website's detail panels.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 130, child: Text(label, style: const TextStyle(color: Tw.gray500, fontSize: 13))),
        Expanded(child: Text(value, style: const TextStyle(color: Tw.slate800, fontSize: 13, fontWeight: FontWeight.w500))),
      ]),
    );
  }
}

/// Section header inside a card: yellow icon + slate-800 title.
class CardTitle extends StatelessWidget {
  const CardTitle(this.title, {super.key, this.icon});
  final String title;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      if (icon != null) ...[Icon(icon, color: Tw.pahangYellow, size: 22), const SizedBox(width: 8)],
      Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: Tw.slate800, fontSize: 15))),
    ]);
  }
}

/// The website's modal: white rounded-2xl panel with a bordered title row.
Future<T?> showWebModal<T>(BuildContext context, {required String title, required Widget Function(BuildContext) body}) {
  return showDialog<T>(
    context: context,
    barrierColor: Colors.black54,
    builder: (context) => Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(24, 12, 12, 12),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Tw.slate200))),
          child: Row(children: [
            Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Tw.gray900))),
            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: Tw.slate400, size: 20)),
          ]),
        ),
        Flexible(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: body(context))),
      ]),
    ),
  );
}

/// Label above a field, like `block text-sm font-medium text-gray-700 mb-1`.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.label, {super.key, this.required = false, this.small = false});
  final String label;
  final bool required;
  final bool small;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text.rich(TextSpan(children: [
        TextSpan(text: label),
        if (required) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
      ]), style: TextStyle(fontSize: small ? 12 : 14, fontWeight: small ? FontWeight.w400 : FontWeight.w500,
          color: small ? Tw.gray500 : Tw.gray700)),
    );
  }
}

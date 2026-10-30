import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import '../web/web_push.dart';
import 'common.dart';

/// Web build only: turns phone notifications on, or explains how to install
/// the app on the iPhone Home Screen first. Hidden on Android/iOS builds and
/// once notifications are on (unless [showWhenOn]).
class WebPushCard extends StatefulWidget {
  const WebPushCard({super.key, this.showWhenOn = false});
  final bool showWhenOn;

  @override
  State<WebPushCard> createState() => _WebPushCardState();
}

class _WebPushCardState extends State<WebPushCard> {
  WebPushState? _state;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) WebPush.instance.refresh().then((s) => mounted ? setState(() => _state = s) : null);
  }

  Future<void> _enable() async {
    setState(() => _busy = true);
    final error = await WebPush.instance.enable();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _state = WebPush.instance.state;
    });
    showToast(context, error ?? 'Notifikasi diaktifkan pada telefon ini.', error == null ? ToastType.success : ToastType.error);
  }

  Future<void> _disable() async {
    setState(() => _busy = true);
    await WebPush.instance.disable();
    if (mounted) {
      setState(() {
        _busy = false;
        _state = WebPush.instance.state;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    if (!kIsWeb || state == null || state == WebPushState.unsupported) return const SizedBox.shrink();
    if (state == WebPushState.on && !widget.showWhenOn) return const SizedBox.shrink();
    final (icon, title, body) = switch (state) {
      WebPushState.on => (Icons.notifications_active_rounded, 'Notifikasi aktif', 'Lantikan baharu akan sampai ke telefon ini.'),
      WebPushState.denied => (Icons.notifications_off_outlined, 'Notifikasi disekat',
          'Benarkan semula di Tetapan → Pemberitahuan → RefPahang.'),
      WebPushState.needsInstall => (Icons.add_to_home_screen_rounded, 'Pasang ke skrin utama',
          'Di Safari, tekan Kongsi → Add to Home Screen, kemudian buka RefPahang dari skrin utama untuk menerima notifikasi.'),
      _ => (Icons.notifications_none_rounded, 'Aktifkan notifikasi', 'Terima lantikan terus ke telefon walaupun app ditutup.'),
    };
    return AppCard(
      color: state == WebPushState.on ? Colors.white : Tw.yellow50,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: state == WebPushState.on ? Tw.emerald600 : AppColors.black),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 2),
            Text(body, style: const TextStyle(fontSize: 13, color: AppColors.muted, height: 1.4)),
            if (state == WebPushState.off) ...[
              const SizedBox(height: 10),
              FilledButton(
                onPressed: _busy ? null : _enable,
                style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                child: Text(_busy ? 'Mengaktifkan...' : 'Aktifkan'),
              ),
            ],
            if (state == WebPushState.on)
              TextButton(onPressed: _busy ? null : _disable, child: const Text('Matikan pada telefon ini')),
          ]),
        ),
      ]),
    );
  }
}

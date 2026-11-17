import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;

import '../api.dart';

enum WebPushState { unsupported, needsInstall, denied, off, on }

/// Subscribes this browser for Web Push with the server's VAPID key and
/// sends the subscription to /api/webpush-subscribe.php. The service worker
/// (web/sw.js) shows the notifications and opens the app on tap.
class WebPush {
  WebPush._();
  static final WebPush instance = WebPush._();

  web.ServiceWorkerRegistration? _registration;
  WebPushState _state = WebPushState.unsupported;

  WebPushState get state => _state;

  bool get _isIos {
    final agent = web.window.navigator.userAgent;
    return RegExp('iPad|iPhone|iPod').hasMatch(agent) ||
        (web.window.navigator.platform == 'MacIntel' && web.window.navigator.maxTouchPoints > 1);
  }

  bool get _standalone =>
      web.window.matchMedia('(display-mode: standalone)').matches ||
      (web.window.navigator as JSObject).getProperty<JSAny?>('standalone'.toJS).dartify() == true;

  bool get _pushSupported =>
      (web.window.navigator as JSObject).has('serviceWorker') && (web.window as JSObject).has('PushManager') &&
      (web.window as JSObject).has('Notification');

  Future<void> init() async {
    if (!(web.window.navigator as JSObject).has('serviceWorker')) return;
    try {
      _registration = await web.window.navigator.serviceWorker
          .register('sw.js'.toJS, web.RegistrationOptions(scope: './'))
          .toDart;
    } catch (error) {
      debugPrint('Service worker not registered: $error');
    }
  }

  Future<WebPushState> refresh({bool syncWithServer = false}) async {
    if (!_pushSupported || _registration == null) {
      return _state = _isIos && !_standalone ? WebPushState.needsInstall : WebPushState.unsupported;
    }
    if (web.Notification.permission == 'denied') return _state = WebPushState.denied;
    final subscription = await _registration!.pushManager.getSubscription().toDart;
    if (subscription != null && syncWithServer) {
      try {
        await Api.instance.post('/api/webpush-subscribe.php', _json(subscription));
      } catch (_) {
        // Retried on the next refresh.
      }
    }
    return _state = subscription == null ? WebPushState.off : WebPushState.on;
  }

  /// Must be called from a tap: iOS shows the permission prompt only then.
  Future<String?> enable() async {
    if (_registration == null) return 'Pelayar ini tidak menyokong notifikasi.';
    try {
      final permission = (await web.Notification.requestPermission().toDart).toDart;
      if (permission != 'granted') {
        _state = permission == 'denied' ? WebPushState.denied : WebPushState.off;
        return 'Kebenaran notifikasi tidak diberikan.';
      }
      final key = '${(await Api.instance.get('/api/webpush-key.php'))['public_key'] ?? ''}';
      if (key.isEmpty) return 'Notifikasi belum diaktifkan oleh pentadbir.';
      final subscription = await _registration!.pushManager
          .subscribe(web.PushSubscriptionOptionsInit(userVisibleOnly: true, applicationServerKey: _decode(key).toJS))
          .toDart;
      await Api.instance.post('/api/webpush-subscribe.php', _json(subscription));
      _state = WebPushState.on;
      return null;
    } on ApiException catch (error) {
      return error.message;
    } catch (error) {
      debugPrint('Web push enable failed: $error');
      return 'Notifikasi tidak dapat diaktifkan. Sila cuba lagi.';
    }
  }

  /// Stops notifications on this device (also before logout).
  Future<void> disable() async {
    final subscription = await _registration?.pushManager.getSubscription().toDart;
    if (subscription == null) {
      if (_state == WebPushState.on) _state = WebPushState.off;
      return;
    }
    try {
      await Api.instance.delete('/api/webpush-subscribe.php', {'endpoint': subscription.endpoint});
    } catch (_) {
      // The browser subscription is dropped below either way.
    }
    try {
      await subscription.unsubscribe().toDart;
    } finally {
      _state = WebPushState.off;
    }
  }

  Map<String, dynamic> _json(web.PushSubscription subscription) => {
        'endpoint': subscription.endpoint,
        'keys': {
          'p256dh': _encode(subscription.getKey('p256dh')),
          'auth': _encode(subscription.getKey('auth')),
        },
      };

  static String _encode(JSArrayBuffer? buffer) =>
      buffer == null ? '' : base64Url.encode(buffer.toDart.asUint8List()).replaceAll('=', '');

  static Uint8List _decode(String value) => base64Url.decode(base64Url.normalize(value));
}

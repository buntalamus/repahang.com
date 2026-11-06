import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api.dart';
import 'firebase_options.dart';
import 'web/web_push.dart';

/// Push notifications: registers this device's FCM token with the server and
/// turns a tapped notification into the app tab to open.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _channel = AndroidNotificationChannel(
    'refpahang', 'Notifikasi RefPahang',
    description: 'Lantikan, permohonan dan makluman sistem',
    importance: Importance.high,
  );

  /// Screen named in the last tapped notification (lantikan, permohonan, sejarah, notifikasi).
  final ValueNotifier<String?> openScreen = ValueNotifier(null);
  final _local = FlutterLocalNotificationsPlugin();
  StreamSubscription<String>? _refresh;
  bool _ready = false;
  bool _localReady = false;

  bool get available => kIsWeb ? WebPush.instance.state == WebPushState.on : _ready;

  Future<void> init() async {
    if (kIsWeb) {
      // The web build (iPhone Home Screen app) uses Web Push; a tapped
      // notification opens ./?screen=<tab> (see web/sw.js).
      openScreen.value = Uri.base.queryParameters['screen'];
      await WebPush.instance.init();
      return;
    }
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@drawable/ic_notification'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
      onDidReceiveNotificationResponse: (response) => openScreen.value = response.payload,
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
    _localReady = true;
    final launch = await _local.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true) openScreen.value = launch!.notificationResponse?.payload;
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    } catch (error) {
      debugPrint('Push disabled: Firebase is not configured ($error)');
      return;
    }
    _ready = true;
    final messaging = FirebaseMessaging.instance;
    // iOS shows foreground pushes itself; Android needs a local notification.
    await messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((message) => openScreen.value = message.data['screen'] as String?);
    final initial = await messaging.getInitialMessage();
    if (initial != null) openScreen.value = initial.data['screen'] as String?;
  }

  void _showForeground(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null || defaultTargetPlatform != TargetPlatform.android) return;
    _local.show(
      id: notification.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(_channel.id, _channel.name,
            channelDescription: _channel.description, importance: Importance.high, priority: Priority.high),
      ),
      payload: message.data['screen'] as String?,
    );
  }

  /// Shows a phone notification from the app itself (e.g. an update is ready).
  Future<void> showLocal(String title, String body, {String? payload}) async {
    if (kIsWeb || !_localReady) return;
    await _local.show(
      id: title.hashCode,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(_channel.id, _channel.name,
            channelDescription: _channel.description, importance: Importance.high, priority: Priority.high),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: payload,
    );
  }

  /// Asks for permission and sends the device token to the server. Call after login.
  Future<void> register() async {
    if (kIsWeb) {
      // Permission needs a tap on the web, so only re-send an existing
      // subscription here; the profile/home card turns it on.
      await WebPush.instance.refresh(syncWithServer: true);
      return;
    }
    if (!_ready) return;
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;
    // Registration tokens match the server's FCM HTTP v1 `message.token`
    // target; the newer FID direct-send flow needs a different server API.
    // ignore: deprecated_member_use
    final token = await messaging.getToken();
    if (token != null) await _send(token);
    await _refresh?.cancel();
    // ignore: deprecated_member_use
    _refresh = messaging.onTokenRefresh.listen(_send);
  }

  Future<void> _send(String token) async {
    final info = await PackageInfo.fromPlatform();
    try {
      await Api.instance.post('/api/push-register.php', {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        'app_version': info.version,
      });
    } on ApiException catch (error) {
      debugPrint('Push registration failed: $error');
    }
  }

  /// The server drops this session's devices on logout; also stop listening here.
  Future<void> stop() async {
    if (kIsWeb) await WebPush.instance.disable();
    await _refresh?.cancel();
    _refresh = null;
  }
}

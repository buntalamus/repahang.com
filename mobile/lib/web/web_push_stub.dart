/// Native builds: notifications go through FCM (push.dart) instead.
enum WebPushState { unsupported, needsInstall, denied, off, on }

class WebPush {
  WebPush._();
  static final WebPush instance = WebPush._();

  WebPushState get state => WebPushState.unsupported;
  Future<void> init() async {}
  Future<WebPushState> refresh({bool syncWithServer = false}) async => WebPushState.unsupported;
  Future<String?> enable() async => 'Tidak disokong pada peranti ini.';
  Future<void> disable() async {}
}

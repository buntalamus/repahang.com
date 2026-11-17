import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Server the app talks to. Build for staging with
/// `flutter build apk --dart-define=API_BASE=https://ujian.refpahang.com`.
const String _apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://refpahang.com');

/// Training copy with fictional data (docs/demo.md). Chosen at run time from
/// the login screen, so the one app (and its Shorebird patches) serves both.
const String demoBase = 'https://demo.refpahang.com';
const _demoKey = 'demo_mode';

/// True while the app talks to [demoBase]; the app shows a DEMO ribbon.
final ValueNotifier<bool> demoMode = ValueNotifier(false);

/// The web build runs on the portal's own domain, so it calls that origin.
String get apiBase => kIsWeb ? Uri.base.origin : (demoMode.value ? demoBase : _apiBase);

Future<void> loadServerChoice() async {
  if (kIsWeb) {
    demoMode.value = Uri.base.host.startsWith('demo.');
    return;
  }
  demoMode.value = await const FlutterSecureStorage().read(key: _demoKey) == '1';
}

Future<void> saveServerChoice(bool demo) async {
  const storage = FlutterSecureStorage();
  if (demo) {
    await storage.write(key: _demoKey, value: '1');
  } else {
    await storage.delete(key: _demoKey);
  }
  demoMode.value = demo;
}

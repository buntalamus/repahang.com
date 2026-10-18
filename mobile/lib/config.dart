import 'package:flutter/foundation.dart';

/// Server the app talks to. Build for staging with
/// `flutter build apk --dart-define=API_BASE=https://ujian.refpahang.com`.
const String _apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://refpahang.com');

/// The web build runs on the portal's own domain, so it calls that origin.
final String apiBase = kIsWeb ? Uri.base.origin : _apiBase;

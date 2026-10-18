/// Server the app talks to. Build for staging with
/// `flutter build apk --dart-define=API_BASE=https://ujian.refpahang.com`.
const String apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://refpahang.com');

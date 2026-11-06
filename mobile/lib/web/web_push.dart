/// Web Push for the app built for the web (iPhone Home Screen app). On
/// Android/iOS builds every call is a no-op; see web_push_browser.dart.
library;

export 'web_push_stub.dart' if (dart.library.js_interop) 'web_push_browser.dart';

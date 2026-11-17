/// Shows a downloaded file: saved and opened in the phone's viewer on
/// Android/iOS, or handed to the browser as a download on the web build.
library;

export 'file_opener_io.dart' if (dart.library.js_interop) 'file_opener_web.dart';

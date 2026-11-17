import 'dart:io';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Writes [bytes] to the app's temporary folder and opens it; false when no
/// app on the phone can show it.
Future<bool> openFileBytes(List<int> bytes, String filename, String mimeType) async {
  final dir = await getTemporaryDirectory();
  final safe = filename.replaceAll(RegExp(r'[^\w.\- ]'), '_');
  final file = File('${dir.path}/$safe');
  await file.writeAsBytes(bytes, flush: true);
  final result = await OpenFilex.open(file.path, type: mimeType);
  return result.type == ResultType.done;
}

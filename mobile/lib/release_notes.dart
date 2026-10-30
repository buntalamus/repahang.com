import 'api.dart';

class MobileReleaseNote {
  MobileReleaseNote(Map<String, dynamic> json)
      : releaseVersion = json['release_version'] as String,
        patch = json['patch'] as int,
        date = json['date'] as String,
        changes = (json['changes'] as List).cast<String>();

  final String releaseVersion;
  final int patch;
  final String date;
  final List<String> changes;
}

List<MobileReleaseNote> releaseNotesFrom(Map<String, dynamic> body) =>
    (body['release_notes'] as List? ?? [])
        .map((row) => MobileReleaseNote(Map<String, dynamic>.from(row as Map))).toList();

/// Exact release/build and downloaded patch boundaries prevent showing future
/// notes, notes from another APK, or changes already installed.
List<MobileReleaseNote> selectPatchNotes(List<MobileReleaseNote> notes, {
  required String releaseVersion, required int currentPatch, required int nextPatch,
}) {
  if (nextPatch <= currentPatch) return [];
  final selected = notes.where((note) => note.releaseVersion == releaseVersion &&
      note.patch > currentPatch && note.patch <= nextPatch).toList()
    ..sort((a, b) => b.patch.compareTo(a.patch));
  // Missing target notes must not be presented as a complete changelog.
  if (!selected.any((note) => note.patch == nextPatch)) return [];
  return selected;
}

List<MobileReleaseNote> selectNativeNotes(List<MobileReleaseNote> notes, String version) =>
    notes.where((note) => note.patch == 0 && note.releaseVersion.split('+').first == version).toList();

Future<List<MobileReleaseNote>> fetchReleaseNotes() async =>
    releaseNotesFrom(await Api.instance.get('/api/mobile-version.php').timeout(const Duration(seconds: 8)));

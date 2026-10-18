import 'package:flutter/foundation.dart';
import 'package:restart_app/restart_app.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

import 'push.dart';

/// Over-the-air updates through Shorebird. The app checks for a patch when it
/// starts and when it comes back to the foreground, downloads it in the
/// background, then tells the user (phone notification + in-app banner) to
/// restart. shorebird.yaml sets auto_update: false so this flow is in charge.
class AppUpdater {
  AppUpdater._();
  static final AppUpdater instance = AppUpdater._();

  static const _minInterval = Duration(minutes: 30);

  final _updater = ShorebirdUpdater();

  /// True once a downloaded patch is waiting for a restart.
  final ValueNotifier<bool> ready = ValueNotifier(false);

  /// True while a patch is being downloaded.
  final ValueNotifier<bool> downloading = ValueNotifier(false);

  DateTime? _lastCheck;
  bool _notified = false;

  bool get available => _updater.isAvailable;

  /// Current patch number, for the profile's version line.
  Future<int?> currentPatch() async {
    if (!available) return null;
    try {
      return (await _updater.readCurrentPatch())?.number;
    } catch (_) {
      return null;
    }
  }

  /// Returns true when a patch is ready to install after this check.
  Future<bool> check({bool force = false}) async {
    if (!available || ready.value || downloading.value) return ready.value;
    final now = DateTime.now();
    if (!force && _lastCheck != null && now.difference(_lastCheck!) < _minInterval) return false;
    _lastCheck = now;
    try {
      var status = await _updater.checkForUpdate();
      if (status == UpdateStatus.outdated) {
        downloading.value = true;
        try {
          await _updater.update();
        } finally {
          downloading.value = false;
        }
        status = await _updater.checkForUpdate();
      }
      if (status == UpdateStatus.restartRequired) {
        ready.value = true;
        if (!_notified) {
          _notified = true;
          await PushService.instance.showLocal(
            'Kemas kini RefPahang sedia',
            'Tekan untuk mula semula app dan guna versi terkini.',
            payload: 'update',
          );
        }
      }
    } catch (error) {
      debugPrint('Update check failed: $error');
    }
    return ready.value;
  }

  /// Restarts the process so the engine loads the downloaded patch.
  Future<void> restart() async {
    await Restart.restartApp(mode: RestartMode.process);
  }
}

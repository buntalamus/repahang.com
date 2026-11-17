// Firebase project refpahangmobile. These client values are public app
// identifiers (they ship inside every APK), not server credentials.
// iOS is not set up yet, so push stays off on iPhone until it is added.
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions? get currentPlatform {
    if (kIsWeb) return null;
    return defaultTargetPlatform == TargetPlatform.android ? android : null;
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDRkRyQhV-SRfHLGSDizZMslV2XpeJbFBc',
    appId: '1:856563784265:android:19174a54cee42133e1bd98',
    messagingSenderId: '856563784265',
    projectId: 'refpahangmobile',
    storageBucket: 'refpahangmobile.firebasestorage.app',
  );
}

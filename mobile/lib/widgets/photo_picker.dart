import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../theme.dart';
import 'common.dart';

/// Camera or gallery photo, cropped square to 400×400 JPEG, within the
/// server's profile-photo limits (≤200 KB, 150–400 px). Null when cancelled.
Future<Uint8List?> pickProfilePhoto(BuildContext context) async {
  final source = await showAppSheet<ImageSource>(context, title: 'Gambar profil', builder: (context) => Column(children: [
    ListTile(
      leading: const Icon(Icons.photo_camera_outlined),
      title: const Text('Ambil gambar'),
      onTap: () => Navigator.pop(context, ImageSource.camera),
    ),
    ListTile(
      leading: const Icon(Icons.photo_library_outlined),
      title: const Text('Pilih dari galeri'),
      onTap: () => Navigator.pop(context, ImageSource.gallery),
    ),
  ]));
  if (source == null) return null;
  XFile? picked;
  try {
    // The web build has no native cropper: let the picker shrink the photo instead.
    picked = await ImagePicker().pickImage(source: source, maxWidth: kIsWeb ? 400 : 1600,
        maxHeight: kIsWeb ? 400 : 1600, imageQuality: kIsWeb ? 80 : null, preferredCameraDevice: CameraDevice.front);
  } catch (_) {
    if (context.mounted) showToast(context, 'Kebenaran kamera/galeri diperlukan.', ToastType.error);
    return null;
  }
  if (picked == null) return null;
  Uint8List bytes;
  if (kIsWeb) {
    bytes = await picked.readAsBytes();
  } else {
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      maxWidth: 400,
      maxHeight: 400,
      compressQuality: 80,
      uiSettings: [
        AndroidUiSettings(toolbarTitle: 'Pangkas gambar', toolbarColor: AppColors.black,
            toolbarWidgetColor: Tw.pahangYellow, activeControlsWidgetColor: Tw.pahangYellow, lockAspectRatio: true,
            initAspectRatio: CropAspectRatioPreset.square, aspectRatioPresets: const [CropAspectRatioPreset.square]),
        IOSUiSettings(title: 'Pangkas gambar', aspectRatioLockEnabled: true, resetAspectRatioEnabled: false),
      ],
    );
    if (cropped == null) return null;
    bytes = await cropped.readAsBytes();
  }
  if (bytes.length > 200 * 1024) {
    if (context.mounted) showToast(context, 'Gambar melebihi 200 KB. Sila pilih gambar lain.', ToastType.warning);
    return null;
  }
  return bytes;
}

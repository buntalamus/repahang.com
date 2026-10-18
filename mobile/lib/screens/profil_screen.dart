import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Profile, following features/pengadil/profile: photo with the yellow ring
/// and camera badge, missing-field notice, details, Telegram and password.
class ProfilScreen extends StatefulWidget {
  const ProfilScreen({super.key});

  @override
  State<ProfilScreen> createState() => _ProfilScreenState();
}

String profileWebPath(SessionUser? user) => switch (user?.role) {
      'Admin' => '/admin/profil',
      'PP Daerah' => '/pp-daerah/profil',
      'Penilai' => '/penilai/profil',
      _ => '/pengadil/profil',
    };

class _ProfilScreenState extends State<ProfilScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  bool _uploading = false;
  int _photoVersion = 0;

  Future<void> _changePhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined, color: Tw.slate700),
            title: const Text('Ambil gambar'),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: Tw.slate700),
            title: const Text('Pilih dari galeri'),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (source == null) return;
    XFile? picked;
    try {
      // The system camera/gallery asks for its own permission when needed.
      picked = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600,
          preferredCameraDevice: CameraDevice.front);
    } catch (_) {
      if (mounted) {
        showToast(context, 'Kebenaran kamera/galeri diperlukan untuk menukar gambar profil.', ToastType.error);
      }
      return;
    }
    if (picked == null) return;
    // Square 400×400 JPEG, the same output as the website's image-crop.
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      maxWidth: 400,
      maxHeight: 400,
      compressQuality: 85,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Pangkas Gambar',
          toolbarColor: Tw.pahangBlack,
          toolbarWidgetColor: Tw.pahangYellow,
          activeControlsWidgetColor: Tw.pahangYellow,
          lockAspectRatio: true,
          hideBottomControls: false,
          initAspectRatio: CropAspectRatioPreset.square,
          aspectRatioPresets: const [CropAspectRatioPreset.square],
        ),
        IOSUiSettings(title: 'Pangkas Gambar', aspectRatioLockEnabled: true, resetAspectRatioEnabled: false),
      ],
    );
    if (cropped == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final result = await Api.instance.upload('/api/upload-profile-image.php', 'image', cropped.path, 'profile.jpg');
      if (!mounted) return;
      showToast(context, text(result['message'], 'Gambar profil berjaya dimuat naik.'));
      imageCache.clear();
      imageCache.clearLiveImages();
      _photoVersion += 1;
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _linkTelegram() async {
    try {
      final body = await Api.instance.get('/api/telegram-link-self.php');
      if (body['linked'] == true) {
        if (mounted) showToast(context, text(body['message'], 'Telegram telah dihubungkan.'));
        await _view.currentState?.reload();
        return;
      }
      final url = text(body['link_url'], '');
      if (url.isNotEmpty) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Api.instance.user.value;
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      loadingMessage: 'Memuatkan profil...',
      load: () async {
        final results = await Future.wait([
          Api.instance.get('/api/get-user-profile.php'),
          Api.instance.get('/api/notifications.php').catchError((_) => <String, dynamic>{}),
        ]);
        return {...results[0], 'unread_count': results[1]['unread_count'] ?? 0};
      },
      builder: (context, body, reload) {
        final u = Map<String, dynamic>.from(body['user'] as Map? ?? {});
        final missing = (body['profile_missing_labels'] as List? ?? []).map((e) => '$e').toList();
        final unread = int.tryParse('${body['unread_count']}') ?? 0;
        final photo = text(u['url_gambar_profil'], '');
        final linked = '${u['telegram_linked']}' == '1';
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (missing.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Tw.amber50,
                  border: Border.all(color: Tw.amber300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Profil belum lengkap', style: TextStyle(fontWeight: FontWeight.w600, color: Tw.amber900)),
                  const SizedBox(height: 4),
                  const Text('Lengkapkan maklumat berikut sebelum memohon pendaftaran tahunan pengadil:',
                      style: TextStyle(fontSize: 14, color: Tw.amber800)),
                  const SizedBox(height: 8),
                  for (final label in missing) Text('•  $label', style: const TextStyle(fontSize: 14, color: Tw.amber900)),
                ]),
              ),
            WebCard(
              borderColor: Colors.transparent,
              padding: const EdgeInsets.all(24),
              margin: const EdgeInsets.only(bottom: 16),
              child: Column(children: [
                Stack(clipBehavior: Clip.none, children: [
                  Container(
                    width: 112,
                    height: 112,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Tw.gray200,
                      border: photo.isEmpty ? null : Border.all(color: Tw.pahangYellow, width: 4),
                    ),
                    child: ClipOval(
                      child: photo.isEmpty
                          ? const Icon(Icons.person, size: 56, color: Tw.gray400)
                          : Image.network(
                              '${Api.instance.absoluteUrl(photo)}${photo.contains('?') ? '&' : '?'}v=$_photoVersion',
                              headers: Api.instance.imageHeaders,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const Icon(Icons.person, size: 56, color: Tw.gray400),
                            ),
                    ),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Material(
                      color: Tw.pahangYellow,
                      shape: const CircleBorder(),
                      elevation: 2,
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _uploading ? null : _changePhoto,
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: _uploading
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                              : const Icon(Icons.camera_alt, size: 16, color: Colors.black, semanticLabel: 'Ubah gambar profil'),
                        ),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                Text(text(u['nama_penuh']), textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                Text(text(u['email']), style: const TextStyle(fontSize: 14, color: Tw.gray500)),
                const SizedBox(height: 4),
                StatusBadge(text(u['jenis_pengadil'], user?.role == 'Pengadil' ? 'Pengadil' : user?.role ?? ''),
                    (Tw.yellow100, Tw.yellow800), pill: true),
              ]),
            ),
            if (unread > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Tw.yellow50,
                  borderRadius: BorderRadius.circular(8),
                  border: const Border(left: BorderSide(color: Tw.pahangYellow, width: 4)),
                ),
                child: Row(children: [
                  const Icon(Icons.notifications_active, color: Tw.pahangYellow),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('Anda mempunyai $unread pemberitahuan belum dibaca.',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: YellowButton(label: 'Kemaskini', icon: Icons.open_in_new,
                    onPressed: () => openWebsite(context, profileWebPath(user))),
              ),
            ),
            WebCard(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                InfoRow('No. telefon', text(u['no_telefon'])),
                InfoRow('No. KP', text(u['no_ic'])),
                InfoRow('Persatuan', text(u['persatuan_bolasepak_daerah'])),
                InfoRow('Alamat', [u['alamat1'], u['alamat2'], u['poskod'], u['daerah'], u['negeri']]
                    .map((e) => text(e, '')).where((e) => e.isNotEmpty).join(', ')),
                InfoRow('Tahun mula aktif', text(u['tahun_mula_aktif'])),
                InfoRow('Saiz baju', text(u['saiz_baju'])),
                InfoRow('Waris', '${text(u['nama_waris'])} (${text(u['hubungan_waris'], '')}) ${text(u['telefon_waris'], '')}'),
              ]),
            ),
            WebCard(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const CardTitle('Notifikasi Telegram', icon: Icons.send_outlined),
                const SizedBox(height: 8),
                Text(linked ? 'Akaun Telegram anda telah dihubungkan.' : 'Hubungkan Telegram untuk menerima lantikan.',
                    style: TextStyle(fontSize: 14, color: linked ? Tw.emerald700 : Tw.slate600)),
                if (!linked) ...[
                  const SizedBox(height: 12),
                  YellowButton(label: 'Hubungkan Telegram', onPressed: _linkTelegram),
                ],
                const SizedBox(height: 12),
                Text(
                  PushService.instance.available
                      ? 'Notifikasi telefon: aktif pada peranti ini.'
                      : 'Notifikasi telefon: tidak tersedia pada peranti ini.',
                  style: const TextStyle(fontSize: 12, color: Tw.slate500),
                ),
              ]),
            ),
            WebCard(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(20),
              onTap: () => showWebModal<void>(context, title: 'Tukar Kata Laluan', body: (_) => const _PasswordForm()),
              child: const Row(children: [
                Expanded(child: CardTitle('Tukar Kata Laluan', icon: Icons.lock_outline)),
                Icon(Icons.chevron_right, color: Tw.slate400),
              ]),
            ),
          ]),
        );
      },
    );
  }
}

class _PasswordForm extends StatefulWidget {
  const _PasswordForm();

  @override
  State<_PasswordForm> createState() => _PasswordFormState();
}

class _PasswordFormState extends State<_PasswordForm> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final result = await Api.instance.post('/api/change-password.php', {
        'current_password': _current.text,
        'new_password': _next.text,
        'confirm_password': _confirm.text,
      });
      if (!mounted) return;
      showToast(context, text(result['message'], 'Kata laluan berjaya ditukar.'));
      Navigator.pop(context);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController controller) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FieldLabel(label),
          TextField(controller: controller, obscureText: true),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _field('Kata Laluan Semasa', _current),
      _field('Kata Laluan Baharu', _next),
      _field('Sahkan Kata Laluan Baharu', _confirm),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        OutlineButton(label: 'Batal', onPressed: _busy ? null : () => Navigator.pop(context)),
        const SizedBox(width: 12),
        YellowButton(label: _busy ? 'Menyimpan...' : 'Simpan', onPressed: _busy ? null : _submit),
      ]),
    ]);
  }
}

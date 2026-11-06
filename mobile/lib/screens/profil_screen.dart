import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../updater.dart';
import '../widgets/common.dart';
import '../widgets/update_notes.dart';
import '../widgets/web_push_card.dart';
import 'notifikasi_screen.dart';
import 'profil_edit_screen.dart';

/// Profile and settings: photo, details, account, app version, logout.
class ProfilScreen extends StatefulWidget {
  const ProfilScreen({super.key});

  @override
  State<ProfilScreen> createState() => _ProfilScreenState();
}

class _ProfilScreenState extends State<ProfilScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  bool _uploading = false;
  int _photoVersion = 0;
  String _version = '';

  @override
  void initState() {
    super.initState();
    Future.wait([PackageInfo.fromPlatform(), AppUpdater.instance.currentPatch()]).then((r) {
      final info = r[0] as PackageInfo;
      final patch = r[1] as int?;
      if (mounted) setState(() => _version = '${info.version}${patch == null ? '' : ' (patch $patch)'}');
    }, onError: (_) {});
  }

  Future<void> _changePhoto() async {
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
    if (source == null) return;
    XFile? picked;
    try {
      // The web build has no native cropper: let the picker shrink the photo
      // to the website's 400px limit instead.
      picked = await ImagePicker().pickImage(source: source, maxWidth: kIsWeb ? 400 : 1600,
          maxHeight: kIsWeb ? 400 : 1600, imageQuality: kIsWeb ? 85 : null, preferredCameraDevice: CameraDevice.front);
    } catch (_) {
      if (mounted) showToast(context, 'Kebenaran kamera/galeri diperlukan untuk menukar gambar.', ToastType.error);
      return;
    }
    if (picked == null) return;
    if (kIsWeb) {
      await _upload(await picked.readAsBytes());
      return;
    }
    // Square 400×400 JPEG, the same output as the website's cropper.
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      maxWidth: 400,
      maxHeight: 400,
      compressQuality: 85,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Pangkas gambar',
          toolbarColor: AppColors.black,
          toolbarWidgetColor: Tw.pahangYellow,
          activeControlsWidgetColor: Tw.pahangYellow,
          lockAspectRatio: true,
          initAspectRatio: CropAspectRatioPreset.square,
          aspectRatioPresets: const [CropAspectRatioPreset.square],
        ),
        IOSUiSettings(title: 'Pangkas gambar', aspectRatioLockEnabled: true, resetAspectRatioEnabled: false),
      ],
    );
    if (cropped == null) return;
    await _upload(await cropped.readAsBytes());
  }

  Future<void> _upload(List<int> bytes) async {
    if (!mounted) return;
    setState(() => _uploading = true);
    try {
      final result = await Api.instance.upload('/api/upload-profile-image.php', 'image', bytes, 'profile.jpg');
      if (!mounted) return;
      showToast(context, text(result['message'], 'Gambar profil dikemas kini.'));
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

  Future<void> _edit(Map<String, dynamic> u) async {
    final saved = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => ProfilEditScreen(profile: u)));
    if (saved == true) await _view.currentState?.reload();
  }

  /// Read-only summary of the profile, grouped like the edit form.
  Widget _summary(Map<String, dynamic> u) {
    String join(List<Object?> parts) => parts.map((e) => text(e, '')).where((e) => e.isNotEmpty).join(', ');
    return _group([
      _info(Icons.badge_outlined, 'No. KP', text(u['no_ic'])),
      _info(Icons.phone_outlined, 'No. telefon', text(u['no_telefon'])),
      _info(Icons.groups_outlined, 'Persatuan', text(u['persatuan_bolasepak_daerah'])),
      _info(Icons.home_outlined, 'Alamat', text(join([u['alamat1'], u['alamat2'], u['poskod'], u['daerah'], u['negeri']]))),
      _info(Icons.work_outline_rounded, 'Pekerjaan', text(join([u['status_kerja'], u['jawatan'], u['nama_majikan']]))),
      _info(Icons.family_restroom_outlined, 'Waris',
          text(join([u['nama_waris'], u['hubungan_waris'], u['telefon_waris']]))),
      _info(Icons.calendar_month_outlined, 'Tahun mula aktif · Saiz baju',
          '${text(u['tahun_mula_aktif'])} · ${text(u['saiz_baju'])}'),
    ]);
  }

  Widget _info(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: DetailRow(icon, label, value),
      );

  Future<void> _logout() async {
    final ok = await confirmSheet(context, title: 'Log keluar?',
        message: 'Notifikasi tidak akan dihantar ke telefon ini selepas anda log keluar.', confirmLabel: 'Log keluar',
        color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    await PushService.instance.stop();
    await Api.instance.logout();
  }

  Future<void> _checkUpdate() async {
    final updater = AppUpdater.instance;
    if (!updater.available) {
      showToast(context, 'Kemas kini automatik tidak tersedia pada pemasangan ini.', ToastType.info);
      return;
    }
    showToast(context, 'Menyemak kemas kini...', ToastType.info);
    final ready = await updater.check(force: true);
    if (!mounted) return;
    if (!ready) {
      showToast(context, 'App anda sudah versi terkini.');
      return;
    }
    final restart = await confirmSheet(context, title: 'Kemas kini sedia',
        details: UpdateNotes(load: updater.pendingReleaseNotes),
        message: 'Versi terkini telah dimuat turun. Mula semula app untuk menggunakannya.', confirmLabel: 'Mula semula');
    if (restart) await updater.restart();
  }

  Widget _group(List<Widget> tiles) => AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < tiles.length; i++) ...[if (i > 0) const Divider(indent: 56), tiles[i]],
        ]),
      );

  ListTile _tile(IconData icon, String title, {String? subtitle, Widget? trailing, VoidCallback? onTap, Color? color}) =>
      ListTile(
        leading: Icon(icon, color: color),
        title: Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color)),
        subtitle: subtitle == null ? null : Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        trailing: trailing ?? (onTap == null ? null : const Icon(Icons.chevron_right_rounded, color: AppColors.faint)),
        onTap: onTap,
      );

  @override
  Widget build(BuildContext context) {
    final user = Api.instance.user.value!;
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      load: () => Api.instance.get('/api/get-user-profile.php'),
      builder: (context, body, reload) {
        final u = Map<String, dynamic>.from(body['user'] as Map? ?? {});
        final missing = (body['profile_missing_labels'] as List? ?? []).map((e) => '$e').toList();
        final linked = '${u['telegram_linked']}' == '1';
        return RefreshList(onRefresh: reload, children: [
          AppCard(
            padding: const EdgeInsets.all(20),
            child: Row(children: [
              Stack(clipBehavior: Clip.none, children: [
                Avatar(name: text(u['nama_penuh'], user.name), photo: u['url_gambar_profil'] as String?, radius: 36,
                    version: _photoVersion),
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Material(
                    color: AppColors.black,
                    shape: const CircleBorder(side: BorderSide(color: Colors.white, width: 2)),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: _uploading ? null : _changePhoto,
                      child: Padding(
                        padding: const EdgeInsets.all(7),
                        child: _uploading
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                            : const Icon(Icons.photo_camera_rounded, size: 14, color: Tw.pahangYellow,
                                semanticLabel: 'Tukar gambar profil'),
                      ),
                    ),
                  ),
                ),
              ]),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text(u['nama_penuh'], user.name), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text(text(u['email'], user.email), style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                  const SizedBox(height: 6),
                  Pill(text(u['jenis_pengadil'], user.role), (Tw.pahangYellow, AppColors.black)),
                ]),
              ),
            ]),
          ),
          if (missing.isNotEmpty)
            AppCard(
              color: Tw.amber50,
              onTap: () => _edit(u),
              child: Row(children: [
                const Icon(Icons.warning_amber_rounded, color: Tw.amber700),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Profil belum lengkap', style: TextStyle(fontWeight: FontWeight.w700, color: Tw.amber900)),
                    Text(missing.join(', '), style: const TextStyle(fontSize: 13, color: Tw.amber800)),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: Tw.amber700),
              ]),
            ),
          if (kIsWeb) const WebPushCard(showWhenOn: true),
          SectionTitle('Maklumat Saya', action: 'Kemaskini', onAction: () => _edit(u)),
          _summary(u),
          const SectionTitle('Akaun'),
          _group([
            _tile(Icons.edit_outlined, 'Kemaskini profil', onTap: () => _edit(u)),
            _tile(Icons.send_outlined, 'Telegram',
                subtitle: linked ? 'Dihubungkan' : 'Belum dihubungkan — tekan untuk hubungkan',
                trailing: Icon(linked ? Icons.check_circle_rounded : Icons.link_rounded,
                    color: linked ? Tw.emerald600 : Tw.amber600),
                onTap: linked ? null : _linkTelegram),
            _tile(Icons.notifications_none_rounded, 'Notifikasi',
                subtitle: kIsWeb ? 'Senarai notifikasi' : (PushService.instance.available ? 'Notifikasi telefon aktif' : 'Notifikasi telefon tidak tersedia'),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const NotifikasiScreen()))),
            _tile(Icons.lock_outline_rounded, 'Tukar kata laluan',
                onTap: () => showAppSheet<void>(context, title: 'Tukar kata laluan', builder: (_) => const _PasswordForm())),
          ]),
          const SectionTitle('App'),
          _group([
            // The web build updates itself on every load.
            if (!kIsWeb)
              _tile(Icons.system_update_rounded, 'Semak kemas kini', subtitle: _version.isEmpty ? null : 'Versi $_version',
                  onTap: _checkUpdate),
            _tile(Icons.logout_rounded, 'Log keluar', color: Tw.rose600, trailing: const SizedBox.shrink(), onTap: _logout),
          ]),
          const SizedBox(height: 8),
          const Text('Pertanyaan teknikal: sokongan@pbnppahang.my', textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.faint)),
        ]);
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

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LabeledField(label: 'Kata laluan semasa', controller: _current, obscure: true),
      LabeledField(label: 'Kata laluan baharu', controller: _next, obscure: true),
      LabeledField(label: 'Sahkan kata laluan baharu', controller: _confirm, obscure: true),
      FilledButton(
        onPressed: _busy ? null : _submit,
        child: _busy
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
            : const Text('Simpan'),
      ),
    ]);
  }
}

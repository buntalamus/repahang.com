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
import 'home_shell.dart' show AppPage;
import 'notifikasi_screen.dart';

String profileWebPath(SessionUser? user) => switch (user?.role) {
      'Admin' => '/admin/profil',
      'PP Daerah' => '/pp-daerah/profil',
      'Penilai' => '/penilai/profil',
      _ => '/pengadil/profil',
    };

/// Website pages listed under "Di website" for each role.
List<(String, IconData, String)> webLinksFor(SessionUser user) => switch (user.role) {
      'Admin' => [
          ('Dashboard penuh', Icons.dashboard_outlined, '/admin'),
          ('Pengguna', Icons.people_outline, '/admin/pengguna'),
          ('Statistik', Icons.insights_outlined, '/admin/statistik'),
          ('Pengumuman', Icons.campaign_outlined, '/admin/pengumuman'),
        ],
      'PP Daerah' => [
          ('Dashboard penuh', Icons.dashboard_outlined, '/pp-daerah'),
          ('Statistik daerah', Icons.insights_outlined, '/pp-daerah/statistik'),
        ],
      'Penilai' => [
          ('Dashboard penuh', Icons.dashboard_outlined, '/penilai'),
          ('Statistik', Icons.bar_chart_outlined, '/penilai/statistik'),
        ],
      _ => [
          ('Dashboard penuh', Icons.dashboard_outlined, '/pengadil'),
          ('Statistik saya', Icons.insights_outlined, '/pengadil/statistik'),
        ],
    };

/// Profile and settings: photo, account, website links, app version, logout.
class ProfilScreen extends StatefulWidget {
  const ProfilScreen({super.key, this.extraPages = const [], this.onOpenPage});
  final List<AppPage> extraPages;
  final void Function(String id, {bool refresh})? onOpenPage;

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
      picked = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600,
          preferredCameraDevice: CameraDevice.front);
    } catch (_) {
      if (mounted) showToast(context, 'Kebenaran kamera/galeri diperlukan untuk menukar gambar.', ToastType.error);
      return;
    }
    if (picked == null) return;
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
    if (cropped == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final result = await Api.instance.upload('/api/upload-profile-image.php', 'image', cropped.path, 'profile.jpg');
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

  void _details(Map<String, dynamic> u) {
    showAppSheet<void>(context, title: 'Maklumat saya', builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DetailRow(Icons.mail_outline, 'Emel', text(u['email'])),
        DetailRow(Icons.phone_outlined, 'No. telefon', text(u['no_telefon'])),
        DetailRow(Icons.badge_outlined, 'No. KP', text(u['no_ic'])),
        DetailRow(Icons.groups_outlined, 'Persatuan', text(u['persatuan_bolasepak_daerah'])),
        DetailRow(Icons.home_outlined, 'Alamat', [u['alamat1'], u['alamat2'], u['poskod'], u['daerah'], u['negeri']]
            .map((e) => text(e, '')).where((e) => e.isNotEmpty).join(', ')),
        DetailRow(Icons.calendar_month_outlined, 'Tahun mula aktif', text(u['tahun_mula_aktif'])),
        DetailRow(Icons.checkroom_outlined, 'Saiz baju', text(u['saiz_baju'])),
        DetailRow(Icons.family_restroom_outlined, 'Waris',
            '${text(u['nama_waris'])} (${text(u['hubungan_waris'], '-')}) ${text(u['telefon_waris'], '')}'),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => openWebsite(context, profileWebPath(Api.instance.user.value)),
          icon: const Icon(Icons.edit_outlined, size: 18),
          label: const Text('Kemaskini di website'),
        ),
      ],
    ));
  }

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
              onTap: () => openWebsite(context, profileWebPath(user)),
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
          const SectionTitle('Akaun'),
          _group([
            _tile(Icons.person_outline, 'Maklumat saya', onTap: () => _details(u)),
            _tile(Icons.send_outlined, 'Telegram',
                subtitle: linked ? 'Dihubungkan' : 'Belum dihubungkan — tekan untuk hubungkan',
                trailing: Icon(linked ? Icons.check_circle_rounded : Icons.link_rounded,
                    color: linked ? Tw.emerald600 : Tw.amber600),
                onTap: linked ? null : _linkTelegram),
            _tile(Icons.notifications_none_rounded, 'Notifikasi',
                subtitle: PushService.instance.available ? 'Notifikasi telefon aktif' : 'Notifikasi telefon tidak tersedia',
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const NotifikasiScreen()))),
            _tile(Icons.lock_outline_rounded, 'Tukar kata laluan',
                onTap: () => showAppSheet<void>(context, title: 'Tukar kata laluan', builder: (_) => const _PasswordForm())),
          ]),
          if (widget.extraPages.isNotEmpty) ...[
            const SectionTitle('Lagi'),
            _group([
              for (final p in widget.extraPages) _tile(p.icon, p.title, onTap: () => widget.onOpenPage?.call(p.id)),
            ]),
          ],
          const SectionTitle('Di website'),
          _group([
            for (final (label, icon, path) in webLinksFor(user))
              _tile(icon, label, trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.faint),
                  onTap: () => openWebsite(context, path)),
          ]),
          const SectionTitle('App'),
          _group([
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

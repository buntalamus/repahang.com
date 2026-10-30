import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/photo_picker.dart';
import '../widgets/profile_form.dart';

/// Shown instead of the app until a new account replaces its emailed
/// password (/api/change-password.php), like the website's /tukar-kata-laluan.
class ForceChangePasswordScreen extends StatefulWidget {
  const ForceChangePasswordScreen({super.key});

  @override
  State<ForceChangePasswordScreen> createState() => _ForceChangePasswordScreenState();
}

class _ForceChangePasswordScreenState extends State<ForceChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final error = _current.text.isEmpty
        ? 'Kata laluan semasa diperlukan.'
        : _next.text.length < 8
            ? 'Kata laluan baharu mesti sekurang-kurangnya 8 aksara.'
            : _next.text != _confirm.text
                ? 'Pengesahan kata laluan tidak sepadan.'
                : null;
    setState(() => _error = error);
    if (error != null) return;
    setState(() => _busy = true);
    try {
      final result = await Api.instance.post('/api/change-password.php', {
        'current_password': _current.text,
        'new_password': _next.text,
        'confirm_password': _confirm.text,
      });
      if (!mounted) return;
      showToast(context, text(result['message'], 'Kata laluan berjaya dikemaskini!'));
      await Api.instance.markPasswordChanged();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    await PushService.instance.stop();
    await Api.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Tukar Kata Laluan'),
        actions: [TextButton(onPressed: _busy ? null : _logout, child: const Text('Log keluar'))],
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
        AppCard(
          color: AppColors.yellowSoft,
          child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.lock_reset_rounded, color: AppColors.black),
            SizedBox(width: 12),
            Expanded(
              child: Text('Untuk keselamatan akaun, sila tukar kata laluan sementara yang dihantar melalui emel sebelum meneruskan.',
                  style: TextStyle(height: 1.5)),
            ),
          ]),
        ),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            LabeledField(label: 'Kata Laluan Semasa', controller: _current, obscure: true, required: true),
            LabeledField(label: 'Kata Laluan Baharu', controller: _next, obscure: true, required: true,
                hint: 'Sekurang-kurangnya 8 aksara'),
            LabeledField(label: 'Sahkan Kata Laluan Baharu', controller: _confirm, obscure: true, required: true),
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: Tw.rose700)),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                  : const Text('Tukar Kata Laluan'),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// Asks for a reset link (/api/forgot-password.php). The emailed link opens
/// the website, which sets the new password.
Future<void> showForgotPassword(BuildContext context, {String email = ''}) {
  final controller = TextEditingController(text: email);
  var busy = false;
  String? error;
  return showAppSheet<void>(context, title: 'Lupa kata laluan', builder: (sheetContext) => StatefulBuilder(
    builder: (context, setState) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Masukkan emel akaun anda. Pautan untuk menetapkan semula kata laluan akan dihantar ke emel tersebut.',
          style: TextStyle(color: Tw.gray600, height: 1.5)),
      const SizedBox(height: 16),
      LabeledField(label: 'Emel', controller: controller, keyboardType: TextInputType.emailAddress, required: true),
      if (error != null) ...[
        Text(error!, style: const TextStyle(color: Tw.rose700)),
        const SizedBox(height: 12),
      ],
      FilledButton(
        onPressed: busy
            ? null
            : () async {
                final value = controller.text.trim();
                if (!emailPattern.hasMatch(value)) {
                  setState(() => error = 'Sila masukkan emel yang sah.');
                  return;
                }
                setState(() {
                  busy = true;
                  error = null;
                });
                try {
                  final result = await Api.instance.post('/api/forgot-password.php', {'email': value});
                  if (!sheetContext.mounted) return;
                  Navigator.pop(sheetContext);
                  showToast(context, text(result['message'], 'Jika emel berdaftar, pautan akan dihantar.'), ToastType.info);
                } on ApiException catch (e) {
                  setState(() {
                    busy = false;
                    error = e.message;
                  });
                }
              },
        child: busy
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
            : const Text('Hantar pautan'),
      ),
    ]),
  ));
}

/// New account registration (/api/register.php), with the website's fields
/// and checks (features/auth/register, cloudflare/src/register.ts).
class DaftarScreen extends StatefulWidget {
  const DaftarScreen({super.key});

  @override
  State<DaftarScreen> createState() => _DaftarScreenState();
}

class _DaftarScreenState extends State<DaftarScreen> {
  final Map<String, dynamic> _form = {'role': 'Pengadil', 'negeri': 'Pahang'};
  late final Future<(Map<String, dynamic>, List<(Object, String)>)> _setup = _load();
  Uint8List? _photo;
  bool _agreed = false;
  bool _busy = false;

  Future<(Map<String, dynamic>, List<(Object, String)>)> _load() async {
    final results = await Future.wait([Api.instance.get('/api/registration-status.php'), loadAssociations()]);
    return (results[0] as Map<String, dynamic>, results[1] as List<(Object, String)>);
  }

  bool get _referee => _form['role'] == 'Pengadil';

  List<FieldSection> _sections(List<(Object, String)> associations) {
    final year = DateTime.now().year;
    String? digits(String label, String v, int min, int max) =>
        RegExp('^\\d{$min,$max}\$').hasMatch(v) ? null : '$label mesti $min${min == max ? '' : '-$max'} digit.';
    return [
      FieldSection('Maklumat Peribadi', [
        const FieldSpec('nama_penuh', 'Nama Penuh (Seperti dalam KP)', required: true, maxLength: 200),
        FieldSpec('no_ic', 'No. Kad Pengenalan', kind: FieldKind.digits, required: true, maxLength: 12,
            hint: 'Tanpa sengkang', validate: (v) => digits('No. Kad Pengenalan', v, 12, 12)),
        const FieldSpec('email', 'Alamat Emel', kind: FieldKind.email, required: true, maxLength: 254),
        FieldSpec('no_telefon', 'No. Telefon Bimbit', kind: FieldKind.phone, required: true, maxLength: 11,
            validate: (v) => digits('No. Telefon', v, 10, 11)),
        FieldSpec('jantina', 'Jantina', kind: FieldKind.select, required: true,
            options: const [('LELAKI', 'Lelaki'), ('PEREMPUAN', 'Perempuan')]),
        const FieldSpec('role', 'Peranan', kind: FieldKind.select, required: true,
            options: [('Pengadil', 'Pengadil'), ('Penilai', 'Penilai Pengadil')]),
        if (_referee)
          FieldSpec('jenis_pengadil', 'Jenis Pengadil', kind: FieldKind.select, required: true,
              options: FieldSpec.plain(const ['Pengadil Baharu', 'Pengadil Kebangsaan', 'Pengadil Negeri'])),
        FieldSpec('persatuan_id', 'Persatuan Bolasepak', kind: FieldKind.select, required: true, options: associations),
      ]),
      FieldSection('Alamat Kediaman', [
        const FieldSpec('alamat1', 'Alamat Kediaman', required: true, maxLength: 500),
        const FieldSpec('alamat2', 'Alamat 2', maxLength: 500),
        FieldSpec('poskod', 'Poskod', kind: FieldKind.digits, required: true, maxLength: 5,
            validate: (v) => digits('Poskod', v, 5, 5)),
        const FieldSpec('daerah', 'Daerah', required: true),
        const FieldSpec('negeri', 'Negeri', required: true),
      ]),
      FieldSection('Maklumat Pekerjaan', [
        FieldSpec('status_kerja', 'Status Pekerjaan', kind: FieldKind.select, required: true,
            options: FieldSpec.plain(statusKerjaOptions)),
        if (isEmployed(_form['status_kerja'])) ...[
          const FieldSpec('jawatan', 'Jawatan', required: true),
          const FieldSpec('nama_majikan', 'Nama Majikan / Institusi', required: true),
          const FieldSpec('alamat_majikan1', 'Alamat Majikan', required: true, maxLength: 500),
          const FieldSpec('alamat_majikan2', 'Alamat Majikan 2', maxLength: 500),
          const FieldSpec('poskod_majikan', 'Poskod Majikan', kind: FieldKind.digits, required: true, maxLength: 5),
          const FieldSpec('daerah_majikan', 'Daerah Majikan', required: true),
          const FieldSpec('negeri_majikan', 'Negeri Majikan', required: true),
        ],
      ]),
      FieldSection(_referee ? 'Waris dan Maklumat Pengadil' : 'Waris', [
        const FieldSpec('nama_waris', 'Nama Waris', required: true),
        FieldSpec('hubungan_waris', 'Hubungan Waris', kind: FieldKind.select, required: true,
            options: FieldSpec.plain(hubunganWarisOptions)),
        FieldSpec('telefon_waris', 'No. Telefon Waris', kind: FieldKind.phone, required: true, maxLength: 11,
            validate: (v) => digits('No. Telefon Waris', v, 10, 11)),
        if (_referee) ...[
          FieldSpec('saiz_baju', 'Saiz Baju', kind: FieldKind.select, required: true,
              options: FieldSpec.plain(const ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])),
          FieldSpec('tahun_mula_aktif', 'Tahun Mula Aktif', kind: FieldKind.number, required: true, maxLength: 4,
              validate: (v) {
            final y = int.tryParse(v) ?? 0;
            return y < 1950 || y > year ? 'Tahun Mula Aktif mesti antara 1950 dan $year.' : null;
          }),
        ],
      ]),
    ];
  }

  Future<void> _pickPhoto() async {
    final bytes = await pickProfilePhoto(context);
    if (bytes != null && mounted) setState(() => _photo = bytes);
  }

  Future<void> _submit(List<FieldSection> sections) async {
    FocusScope.of(context).unfocus();
    final problem = validateSections(sections, _form) ??
        (_photo == null ? 'Gambar Profil diperlukan.' : null) ??
        (!_agreed ? 'Sila sahkan bahawa maklumat yang diberikan adalah benar.' : null);
    if (problem != null) {
      showToast(context, problem, ToastType.warning);
      return;
    }
    setState(() => _busy = true);
    try {
      final fields = <String, String>{
        for (final e in _form.entries)
          if (e.value != null) e.key: '${e.value}'.trim(),
        if (!_referee) 'jenis_pengadil': 'Penilai Pengadil',
        'pengesahan_data': 'true',
      };
      final result = await Api.instance.postForm('/api/register.php', fields,
          files: {'gambar_profil': (_photo!, 'profile.jpg')});
      if (!mounted) return;
      await _done(result);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _done(Map<String, dynamic> result) async {
    final telegram = text(result['telegram_link'], '');
    await showDialog<void>(context: context, barrierDismissible: false, builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.check_circle_rounded, color: Tw.emerald600, size: 48),
      title: const Text('Pendaftaran berjaya'),
      content: Text(text(result['message'], 'Kata laluan sementara telah dihantar ke emel anda.')),
      actions: [
        if (telegram.isNotEmpty)
          TextButton(
            onPressed: () => launchUrl(Uri.parse(telegram), mode: LaunchMode.externalApplication),
            child: const Text('Hubungkan Telegram'),
          ),
        FilledButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Log masuk')),
      ],
    ));
    if (mounted) Navigator.pop(context, '${_form['email'] ?? ''}'.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Daftar Akaun')),
      body: FutureBuilder<(Map<String, dynamic>, List<(Object, String)>)>(
        future: _setup,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Loading();
          if (snapshot.hasError) {
            return EmptyState(icon: Icons.cloud_off_rounded, title: 'Tidak dapat dimuatkan', subtitle: '${snapshot.error}');
          }
          final (status, associations) = snapshot.data!;
          if (status['registration_open'] != true) {
            return EmptyState(icon: Icons.event_busy_rounded, title: 'Pendaftaran ditutup',
                subtitle: text(status['registration_message'], 'Pendaftaran akaun baharu tidak dibuka buat masa ini.'));
          }
          final sections = _sections(associations);
          return ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
            ProfileForm(sections: sections, values: _form, onChanged: () => setState(() {})),
            const SectionTitle('Gambar Profil'),
            AppCard(
              onTap: _busy ? null : _pickPhoto,
              child: Row(children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: AppColors.yellowSoft, borderRadius: BorderRadius.circular(16)),
                  clipBehavior: Clip.antiAlias,
                  child: _photo == null
                      ? const Icon(Icons.add_a_photo_outlined, color: AppColors.black)
                      : Image.memory(_photo!, fit: BoxFit.cover),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_photo == null ? 'Pilih gambar profil *' : 'Tukar gambar',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    const Text('Gambar berukuran pasport, muka jelas. JPG/PNG, maksimum 200 KB.',
                        style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 4),
            CheckboxListTile(
              value: _agreed,
              onChanged: (v) => setState(() => _agreed = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              activeColor: AppColors.black,
              checkColor: Tw.pahangYellow,
              title: const Text('Saya dengan ini mengesahkan bahawa semua maklumat yang diberikan adalah benar dan tepat.',
                  style: TextStyle(fontSize: 13.5, height: 1.4)),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _busy ? null : () => _submit(sections),
              child: _busy
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                  : const Text('Daftar'),
            ),
          ]);
        },
      ),
    );
  }
}

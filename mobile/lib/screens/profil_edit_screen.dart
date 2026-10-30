import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/profile_form.dart';

/// Edits the signed-in user's own profile (/api/update-profile.php), with the
/// website's fields and locks (profile-fields.component.ts, profile-write.ts).
class ProfilEditScreen extends StatefulWidget {
  const ProfilEditScreen({super.key, required this.profile});

  /// The `user` object from /api/get-user-profile.php.
  final Map<String, dynamic> profile;

  @override
  State<ProfilEditScreen> createState() => _ProfilEditScreenState();
}

class _ProfilEditScreenState extends State<ProfilEditScreen> {
  late final Map<String, dynamic> _draft = Map<String, dynamic>.from(widget.profile);
  late final Future<List<(Object, String)>> _associations = loadAssociations().catchError((_) => <(Object, String)>[]);
  bool _saving = false;

  SessionUser get _user => Api.instance.user.value!;

  List<FieldSection> _sections(List<(Object, String)> associations) {
    final admin = _user.isAdmin;
    final role = _user.role;
    // Non-Admin roles must fill these on save (profile-write.ts).
    final need = !admin;
    final lockedAssociation = !admin && (role == 'PP Daerah' || text(widget.profile['persatuan_id'], '').isNotEmpty);
    final lockedKind = !admin && text(widget.profile['jenis_pengadil'], '').isNotEmpty;
    final kinds = admin ? allJenisPengadil : (role == 'Penilai' ? const ['Penilai Pengadil'] : pengadilKinds);
    const adminNote = 'Hubungi Admin untuk menukar maklumat ini.';
    final employed = isEmployed(_draft['status_kerja']);
    final year = DateTime.now().year;
    String? yearCheck(String label, String value, int max) {
      final y = int.tryParse(value);
      if (value.length != 4 || y == null || y < 1900 || y > max) return '$label mesti tahun antara 1900 dan $max.';
      return null;
    }

    return [
      FieldSection('Maklumat Peribadi', [
        const FieldSpec('nama_penuh', 'Nama Penuh', required: true, maxLength: 255),
        const FieldSpec('no_ic', 'No. Kad Pengenalan', maxLength: 14),
        const FieldSpec('email', 'Emel', kind: FieldKind.email, required: true, maxLength: 254),
        const FieldSpec('no_telefon', 'No. Telefon', kind: FieldKind.phone, maxLength: 11),
        FieldSpec('jantina', 'Jantina', kind: FieldKind.select, options: FieldSpec.plain(jantinaOptions)),
        FieldSpec('umur', 'Umur', kind: FieldKind.number, maxLength: 3, validate: (v) {
          final n = int.tryParse(v);
          return n == null || n > 120 ? 'Umur mesti antara 0 dan 120.' : null;
        }),
        FieldSpec('persatuan_id', 'Persatuan Bola Sepak Daerah', kind: FieldKind.select, options: associations,
            readOnly: lockedAssociation, note: adminNote),
        FieldSpec('saiz_baju', 'Saiz Baju', kind: FieldKind.select, options: FieldSpec.plain(saizBajuOptions)),
      ]),
      FieldSection('Alamat Kediaman', [
        FieldSpec('alamat1', 'Alamat 1', required: need, maxLength: 500),
        const FieldSpec('alamat2', 'Alamat 2', maxLength: 500),
        FieldSpec('poskod', 'Poskod', kind: FieldKind.digits, required: need, maxLength: 5),
        FieldSpec('daerah', 'Daerah', required: need),
        FieldSpec('negeri', 'Negeri', required: need),
      ]),
      FieldSection('Maklumat Pekerjaan', [
        FieldSpec('status_kerja', 'Status Pekerjaan', kind: FieldKind.select, required: need,
            options: FieldSpec.plain(statusKerjaOptions)),
        if (employed) ...[
          const FieldSpec('jawatan', 'Jawatan'),
          const FieldSpec('nama_majikan', 'Nama Majikan'),
          const FieldSpec('alamat_majikan1', 'Alamat Majikan 1', maxLength: 500),
          const FieldSpec('alamat_majikan2', 'Alamat Majikan 2', maxLength: 500),
          const FieldSpec('poskod_majikan', 'Poskod Majikan', kind: FieldKind.digits, maxLength: 5),
          const FieldSpec('daerah_majikan', 'Daerah Majikan'),
          const FieldSpec('negeri_majikan', 'Negeri Majikan'),
        ],
      ]),
      FieldSection('Maklumat Waris', [
        FieldSpec('nama_waris', 'Nama Waris', required: need),
        FieldSpec('hubungan_waris', 'Hubungan Waris', required: need),
        FieldSpec('telefon_waris', 'No. Telefon Waris', kind: FieldKind.phone, required: need, maxLength: 11),
      ]),
      FieldSection('Kelayakan Pengadil', [
        FieldSpec('jenis_pengadil', 'Jenis Pengadil', kind: FieldKind.select, options: FieldSpec.plain(kinds),
            readOnly: lockedKind, note: adminNote),
        const FieldSpec('jenis_penilai', 'Jenis Penilai'),
        for (final MapEntry(key: key, value: label) in yearLabels.entries)
          FieldSpec(key, label, kind: FieldKind.number, maxLength: 4,
              validate: (v) => yearCheck(label, v, key.startsWith('tahun_mohon') ? year + 1 : year)),
      ]),
    ];
  }

  Future<void> _save(List<FieldSection> sections) async {
    FocusScope.of(context).unfocus();
    final problem = validateSections(sections, _draft);
    if (problem != null) {
      showToast(context, problem, ToastType.warning);
      return;
    }
    setState(() => _saving = true);
    try {
      // The website posts the whole record; the server ignores unknown keys.
      final body = {
        for (final e in _draft.entries)
          e.key: e.value is String ? (e.value as String).trim() : e.value,
      };
      final result = await Api.instance.post('/api/update-profile.php', body);
      if (!mounted) return;
      showToast(context, text(result['message'], 'Profil berjaya dikemaskini!'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<(Object, String)>>(
      future: _associations,
      builder: (context, snapshot) {
        final sections = _sections(snapshot.data ?? const []);
        return Scaffold(
          appBar: AppBar(title: const Text('Kemaskini Profil')),
          body: snapshot.connectionState != ConnectionState.done
              ? const Loading()
              : ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
                  ProfileForm(sections: sections, values: _draft, onChanged: () => setState(() {})),
                ]),
          bottomNavigationBar: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: FilledButton(
                onPressed: _saving || snapshot.connectionState != ConnectionState.done ? null : () => _save(sections),
                child: _saving
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                    : const Text('Simpan'),
              ),
            ),
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../theme.dart';
import 'common.dart';

/// Option lists shared with the website's profile and registration forms
/// (frontend/src/app/shared/components/profile-fields, features/auth/register).
const jantinaOptions = ['Lelaki', 'Perempuan'];
const saizBajuOptions = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const statusKerjaOptions = ['Bekerja (Kerajaan)', 'Bekerja (Swasta)', 'Bekerja Sendiri', 'Pelajar', 'Tidak Bekerja', 'Pesara'];
const hubunganWarisOptions = ['Ibu Bapa', 'Pasangan', 'Anak', 'Adik-beradik', 'Lain-lain'];
const pengadilKinds = ['Pengadil Baharu', 'Pengadil Negeri', 'Pengadil Kebangsaan'];
const allJenisPengadil = ['Pengadil Baharu', 'Kelas III FAM', 'Kelas I FAM', 'Pengadil Negeri', 'Pengadil Kebangsaan',
    'Penilai Pengadil', 'Pegawai Pembangunan'];
const yearLabels = {
  'tahun_mula_aktif': 'Tahun Mula Aktif',
  'tahun_mohon_kelas3': 'Tahun Mohon Kelas III FAM',
  'tahun_lulus_kelas3': 'Tahun Lulus Kelas III FAM',
  'tahun_mohon_kelas1': 'Tahun Mohon Kelas I FAM',
  'tahun_lulus_kelas1': 'Tahun Lulus Kelas I FAM',
};
const employerKeys = ['jawatan', 'nama_majikan', 'alamat_majikan1', 'alamat_majikan2', 'poskod_majikan', 'daerah_majikan',
    'negeri_majikan'];

final emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Employer details are only asked for people who work (referee-profile.ts).
bool isEmployed(Object? status) {
  final value = '${status ?? ''}'.trim().toUpperCase();
  return value.isNotEmpty && !const ['PELAJAR', 'TIDAK BEKERJA', 'PESARA'].contains(value);
}

/// Active district associations as dropdown options: (id, "Nama (KOD)").
Future<List<(Object, String)>> loadAssociations() async {
  final body = await Api.instance.get('/api/public-persatuan.php');
  return [
    for (final row in (body['data'] as List? ?? []).cast<Map>())
      (int.tryParse('${row['id']}') ?? 0,
          text(row['kod_persatuan'], '').isEmpty ? text(row['nama_persatuan']) : '${text(row['nama_persatuan'])} (${row['kod_persatuan']})'),
  ];
}

enum FieldKind { text, email, phone, digits, number, select }

class FieldSpec {
  const FieldSpec(this.key, this.label, {this.kind = FieldKind.text, this.options = const [], this.required = false,
      this.readOnly = false, this.note, this.maxLength, this.maxLines = 1, this.validate, this.hint});
  final String key;
  final String label;
  final FieldKind kind;

  /// (stored value, label) pairs for [FieldKind.select].
  final List<(Object, String)> options;
  final bool required;
  final bool readOnly;

  /// Shown under a read-only field, e.g. who can change it.
  final String? note;
  final int? maxLength;
  final int maxLines;
  final String? hint;

  /// Extra check on the trimmed value; returns an error message.
  final String? Function(String value)? validate;

  static List<(Object, String)> plain(List<String> values) => [for (final v in values) (v, v)];
}

class FieldSection {
  const FieldSection(this.title, this.fields, {this.icon});
  final String title;
  final IconData? icon;
  final List<FieldSpec> fields;
}

/// First problem with [values] against [sections], or null when valid.
String? validateSections(List<FieldSection> sections, Map<String, dynamic> values) {
  for (final section in sections) {
    for (final field in section.fields) {
      final value = '${values[field.key] ?? ''}'.trim();
      if (field.readOnly) continue;
      if (value.isEmpty) {
        if (field.required) return '${field.label} diperlukan.';
        continue;
      }
      if (field.kind == FieldKind.email && !emailPattern.hasMatch(value)) return '${field.label} tidak sah.';
      final error = field.validate?.call(value);
      if (error != null) return error;
    }
  }
  return null;
}

/// Profile-style form: one card per section, writing into [values] as the user types.
class ProfileForm extends StatefulWidget {
  const ProfileForm({super.key, required this.sections, required this.values, this.onChanged});
  final List<FieldSection> sections;
  final Map<String, dynamic> values;

  /// Called after any change, so the parent can show or hide dependent fields.
  final VoidCallback? onChanged;

  @override
  State<ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<ProfileForm> {
  final _controllers = <String, TextEditingController>{};

  TextEditingController _controller(String key) =>
      _controllers.putIfAbsent(key, () => TextEditingController(text: text(widget.values[key], '')));

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Widget _label(FieldSpec f) => Text.rich(
        TextSpan(children: [
          TextSpan(text: f.label),
          if (f.required && !f.readOnly) const TextSpan(text: ' *', style: TextStyle(color: Tw.rose500)),
        ]),
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tw.gray700),
      );

  Widget _field(FieldSpec f) {
    if (f.readOnly) {
      final raw = widget.values[f.key];
      final shown = f.kind == FieldKind.select
          ? f.options.where((o) => '${o.$1}' == '${raw ?? ''}').map((o) => o.$2).firstOrNull ?? text(raw)
          : text(raw);
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: AppColors.grey100, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Expanded(child: Text(shown, style: const TextStyle(fontSize: 15, color: Tw.gray600))),
          const Icon(Icons.lock_outline_rounded, size: 16, color: AppColors.faint),
        ]),
      );
    }
    if (f.kind == FieldKind.select) {
      final current = widget.values[f.key];
      final options = [...f.options];
      // Keep a stored value the list does not know (e.g. "LELAKI" from registration).
      if (current != null && '$current'.isNotEmpty && !options.any((o) => '${o.$1}' == '$current')) {
        options.insert(0, (current as Object, '$current'));
      }
      final selected = options.where((o) => '${o.$1}' == '${current ?? ''}').map((o) => o.$1).firstOrNull;
      return DropdownButtonFormField<Object>(
        initialValue: selected,
        isExpanded: true,
        hint: Text(f.hint ?? 'Pilih', style: const TextStyle(color: AppColors.faint)),
        borderRadius: BorderRadius.circular(12),
        dropdownColor: Colors.white,
        items: [
          for (final (value, label) in options)
            DropdownMenuItem(value: value, child: Text(label, overflow: TextOverflow.ellipsis)),
        ],
        onChanged: (value) {
          setState(() => widget.values[f.key] = value);
          widget.onChanged?.call();
        },
      );
    }
    final digits = f.kind == FieldKind.digits || f.kind == FieldKind.number || f.kind == FieldKind.phone;
    return TextField(
      controller: _controller(f.key),
      maxLines: f.maxLines,
      maxLength: f.maxLength,
      keyboardType: switch (f.kind) {
        FieldKind.email => TextInputType.emailAddress,
        FieldKind.phone => TextInputType.phone,
        FieldKind.digits || FieldKind.number => TextInputType.number,
        _ => f.maxLines > 1 ? TextInputType.multiline : TextInputType.text,
      },
      inputFormatters: digits ? [FilteringTextInputFormatter.digitsOnly] : null,
      textCapitalization: f.kind == FieldKind.text ? TextCapitalization.words : TextCapitalization.none,
      decoration: InputDecoration(hintText: f.hint, counterText: ''),
      onChanged: (value) {
        widget.values[f.key] = value;
        widget.onChanged?.call();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final section in widget.sections)
        if (section.fields.isNotEmpty) ...[
          SectionTitle(section.title),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (i, f) in section.fields.indexed) ...[
                if (i > 0) const SizedBox(height: 14),
                _label(f),
                const SizedBox(height: 6),
                _field(f),
                if (f.readOnly && f.note != null) ...[
                  const SizedBox(height: 4),
                  Text(f.note!, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ],
            ]),
          ),
        ],
    ]);
  }
}

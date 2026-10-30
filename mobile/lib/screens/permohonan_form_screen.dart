import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/photo_picker.dart';
import '../widgets/profile_form.dart';
import 'profil_edit_screen.dart';

/// An application form the user can submit (/api/pengadil-application.php),
/// as on the website's features/pengadil/application page.
class AppForm {
  const AppForm(this.jenis, this.label, this.subtitle, this.icon, this.historyType, this.window);
  final String jenis;
  final String label;
  final String subtitle;
  final IconData icon;

  /// `type` for /api/pengadil-application-history.php.
  final String historyType;

  /// Key in application-settings.php `windows`.
  final String window;

  bool get annual => jenis == 'pengadil_berdaftar' || jenis == 'penilai_berdaftar';
  bool get referee => jenis == 'pengadil_berdaftar';
  bool get fam => jenis == 'kelas3_fam' || jenis == 'ujian_kelas1_fam';
}

const _berdaftar = AppForm('pengadil_berdaftar', 'Pendaftaran Tahunan Pengadil (R1+R2+R4)', 'Pendaftaran tahunan pengadil',
    Icons.badge_outlined, 'berdaftar', 'berdaftar');
const _penilai = AppForm('penilai_berdaftar', 'Pendaftaran Tahunan Penilai Pengadil (R1)', 'Pendaftaran tahunan penilai',
    Icons.how_to_reg_outlined, 'penilai_berdaftar', 'penilai');
const _kelas3 = AppForm('kelas3_fam', 'Peperiksaan Kelas III FAM', 'Kursus dan peperiksaan pengadil Kelas III',
    Icons.quiz_outlined, 'kelas3', 'bertulis');
const _kelas1 = AppForm('ujian_kelas1_fam', 'Ujian Kelas I FAM', 'Ujian pengadil Kelas I', Icons.military_tech_outlined,
    'kelas1', 'kelas1');

/// Forms each role may submit (application-submit.ts).
List<AppForm> appFormsFor(SessionUser user) => switch (user.role) {
      'PP Daerah' => [if (user.canReferee) _berdaftar, _penilai, _kelas3, _kelas1],
      'Penilai' => const [_penilai],
      'Admin' => user.jenisPengadil == 'Penilai Pengadil' ? const [_penilai] : const [],
      _ => const [_berdaftar, _kelas3, _kelas1],
    };

/// `type` for /api/download-borang-pendaftaran.php, or null when the form has
/// no printable copy for this application yet.
String? registrationPdfType(Map<String, dynamic> application) {
  final status = '${application['status_workflow'] ?? application['status'] ?? ''}';
  final approved = const ['Approved', 'Lengkap', 'Admin Diluluskan'].contains(status) || application['status'] == 'Approved';
  return switch ('${application['jenis_borang']}') {
    'pengadil_berdaftar' => 'pengadil_berdaftar',
    'penilai_berdaftar' => 'penilai_berdaftar',
    'kelas3_fam' => 'kelas3_fam',
    'ujian_kelas1_fam' when approved => 'ujian_kelas1',
    _ => null,
  };
}

Future<void> downloadApplicationPdf(BuildContext context, Map<String, dynamic> application) async {
  final type = registrationPdfType(application);
  if (type == null) return;
  await downloadAndOpen(context, '/api/download-borang-pendaftaran.php',
      query: {'type': type, 'application_id': application['id']}, fallbackName: 'Borang_${application['id']}.pdf');
}

class _Setup {
  _Setup(this.settings, this.windows, this.profile, this.missing, this.history);
  final Map<String, dynamic> settings;
  final Map<String, dynamic> windows;
  final Map<String, dynamic> profile;
  final List<String> missing;
  final List<Map<String, dynamic>> history;

  String get year => text(settings['application_year'], '${DateTime.now().year + 1}');
}

class PermohonanFormScreen extends StatefulWidget {
  const PermohonanFormScreen({super.key, required this.form});
  final AppForm form;

  @override
  State<PermohonanFormScreen> createState() => _PermohonanFormScreenState();
}

class _PermohonanFormScreenState extends State<PermohonanFormScreen> {
  final _view = GlobalKey<AsyncViewState<_Setup>>();
  final Map<String, dynamic> _values = {};
  bool _prefilled = false;
  (Uint8List, String)? _resit;
  Uint8List? _gambar;
  final _health = List.filled(5, false);
  final _declare = List.filled(3, false);
  bool _busy = false;

  AppForm get form => widget.form;

  Future<_Setup> _load() async {
    final results = await Future.wait([
      Api.instance.get('/api/application-settings.php'),
      Api.instance.get('/api/get-user-profile.php'),
      Api.instance.get('/api/pengadil-application-history.php', {'type': form.historyType}),
    ]);
    final profile = Map<String, dynamic>.from(results[1]['user'] as Map? ?? {});
    if (!_prefilled) {
      _prefilled = true;
      for (final key in ['nama_waris', 'hubungan_waris', 'telefon_waris', 'saiz_baju']) {
        _values[key] = text(profile[key], '');
      }
      if (!const ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].contains(_values['saiz_baju'])) _values['saiz_baju'] = null;
      if (!hubunganWarisOptions.contains(_values['hubungan_waris'])) _values['hubungan_waris'] = null;
    }
    return _Setup(
      Map<String, dynamic>.from(results[0]['settings'] as Map? ?? {}),
      Map<String, dynamic>.from(results[0]['windows'] as Map? ?? {}),
      profile,
      (results[1]['profile_missing_labels'] as List? ?? []).map((e) => '$e').toList(),
      (results[2]['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
    );
  }

  String _date(Object? raw) {
    final parts = '${raw ?? ''}'.split('-');
    return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : text(raw);
  }

  Future<void> _pickResit() async {
    PlatformFile? file;
    try {
      file = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png']);
    } catch (_) {
      if (mounted) showToast(context, 'Fail tidak dapat dipilih.', ToastType.error);
      return;
    }
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024) {
      if (mounted) showToast(context, 'Resit melebihi 5MB.', ToastType.warning);
      return;
    }
    if (mounted) setState(() => _resit = (bytes, file!.name));
  }

  Future<void> _pickGambar() async {
    final bytes = await pickProfilePhoto(context);
    if (bytes != null && mounted) setState(() => _gambar = bytes);
  }

  List<FieldSection> get _sections => [
        FieldSection('Maklumat Waris', [
          const FieldSpec('nama_waris', 'Nama Waris', required: true, maxLength: 255),
          FieldSpec('hubungan_waris', 'Hubungan', kind: FieldKind.select, required: true,
              options: FieldSpec.plain(hubunganWarisOptions)),
          FieldSpec('telefon_waris', 'No. Telefon Waris', kind: FieldKind.phone, required: true, maxLength: 11),
          if (form.annual)
            FieldSpec('saiz_baju', 'Saiz Baju Rasmi', kind: FieldKind.select, required: true,
                options: FieldSpec.plain(const ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])),
        ]),
      ];

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final problem = validateSections(_sections, _values) ??
        (_resit == null ? (form.fam ? 'Sila muat naik resit bayaran FAM.' : 'Sila muat naik resit bayaran.') : null) ??
        (form.annual && _gambar == null ? 'Sila muat naik gambar profil.' : null) ??
        (form.referee && _health.contains(false) ? 'Sila tandakan semua perakuan kesihatan.' : null) ??
        (!_declare[0] || !_declare[1] || (form.annual && !_declare[2]) ? 'Sila tandakan semua perakuan.' : null);
    if (problem != null) {
      showToast(context, problem, ToastType.warning);
      return;
    }
    final ok = await confirmSheet(context, title: 'Hantar permohonan?', message: '${form.label}. Pastikan semua maklumat betul.',
        confirmLabel: 'Hantar');
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      final result = await Api.instance.postForm('/api/pengadil-application.php', {
        'jenis_borang': form.jenis,
        for (final key in ['nama_waris', 'hubungan_waris', 'telefon_waris', if (form.annual) 'saiz_baju'])
          key: '${_values[key] ?? ''}'.trim(),
      }, files: {
        'resit': (_resit!.$1, _resit!.$2),
        if (form.annual) 'gambar': (_gambar!, 'gambar.jpg'),
      });
      if (!mounted) return;
      showToast(context, text(result['message'], 'Permohonan berjaya dihantar.'));
      if (result['email_sent'] == false && text(result['email_message'], '').isNotEmpty) {
        await Future<void>.delayed(const Duration(seconds: 3));
        if (mounted) showToast(context, text(result['email_message']), ToastType.warning);
      }
      _resit = null;
      _gambar = null;
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(form.fam ? form.label : 'Pendaftaran Tahunan')),
      body: AsyncView<_Setup>(
        key: _view,
        load: _load,
        builder: (context, setup, reload) {
          final window = Map<String, dynamic>.from(setup.windows[form.window] as Map? ?? {});
          final current = setup.history.where((a) => '${a['tahun_permohonan']}' == setup.year).firstOrNull;
          final state = text(window['state'], 'off');
          return RefreshList(onRefresh: reload, bottomPadding: 32, children: [
            Text(form.label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text('Sesi ${setup.year}', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 8),
            if (current != null)
              _currentCard(current)
            else if (state != 'open')
              _notice(Icons.event_busy_rounded, state == 'closed' ? 'Permohonan Telah Ditutup' : 'Permohonan Belum Dibuka',
                  state == 'not_yet'
                      ? 'Permohonan ${form.label} untuk sesi ${setup.year} akan dibuka pada ${_date(window['open_date'])}.'
                      : state == 'closed'
                          ? 'Permohonan ${form.label} untuk sesi ${setup.year} telah ditutup pada ${_date(window['close_date'])}.'
                          : 'Permohonan ${form.label} untuk sesi ${setup.year} belum dibuka. Sila semak semula kemudian.')
            else if (form.referee && setup.missing.isNotEmpty)
              _missingProfile(setup)
            else
              ..._form(setup),
            if (setup.history.isNotEmpty) ...[
              const SectionTitle('Sejarah Permohonan'),
              for (final a in setup.history) _historyRow(a),
            ],
          ]);
        },
      ),
    );
  }

  Widget _notice(IconData icon, String title, String body, {Color color = AppColors.yellowSoft}) => AppCard(
        color: color,
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: AppColors.black),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(body, style: const TextStyle(fontSize: 13.5, height: 1.5)),
            ]),
          ),
        ]),
      );

  Widget _currentCard(Map<String, dynamic> a) {
    final status = text(a['status_workflow'] ?? a['status']);
    final notes = text(a['pp_notes'] ?? a['admin_notes'], '');
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const Expanded(child: Text('Permohonan Semasa', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
          Pill(status, applicationTone(status)),
        ]),
        const SizedBox(height: 4),
        DetailRow(Icons.send_outlined, 'Tarikh hantar', text(a['tarikh_hantar'])),
        if (form.referee) ...[
          DetailRow(Icons.school_outlined, 'Seminar', text(a['status_seminar'], 'Belum dikemaskini')),
          DetailRow(Icons.directions_run, 'Ujian kecergasan', text(a['fitness_status'] ?? a['status_ujian'], 'Belum dikemaskini')),
        ],
        if (notes.isNotEmpty) DetailRow(Icons.comment_outlined, 'Catatan', notes),
        if (registrationPdfType(a) != null) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => downloadApplicationPdf(context, a),
            icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
            label: const Text('Muat turun borang (PDF)'),
          ),
        ],
      ]),
    );
  }

  Widget _missingProfile(_Setup setup) => AppCard(
        color: Tw.amber50,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Lengkapkan profil dahulu', style: TextStyle(fontWeight: FontWeight.w700, color: Tw.amber900)),
          const SizedBox(height: 4),
          Text('Maklumat berikut diperlukan sebelum memohon: ${setup.missing.join(', ')}.',
              style: const TextStyle(fontSize: 13.5, color: Tw.amber800, height: 1.5)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => ProfilEditScreen(profile: setup.profile)));
              if (saved == true) await _view.currentState?.reload();
            },
            child: const Text('Kemaskini Profil'),
          ),
        ]),
      );

  List<Widget> _form(_Setup setup) {
    final s = setup.settings;
    final p = setup.profile;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 110, child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.muted))),
            Expanded(child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
          ]),
        );
    final fee = switch (form.jenis) {
      'kelas3_fam' => text(s['bertulis_fee'], '50.00'),
      'ujian_kelas1_fam' => text(s['kelas1_fee'], '300.00'),
      _ => text(s['payment_amount'], '80.00'),
    };
    final year = int.tryParse(setup.year) ?? DateTime.now().year;
    return [
      if (form.jenis == 'kelas3_fam')
        _notice(Icons.info_outline_rounded, 'Syarat kelayakan',
            'Umur antara ${text(s['bertulis_min_age'], '15')} hingga ${text(s['bertulis_max_age'], '40')} tahun pada sesi ${setup.year}.'),
      if (form.jenis == 'ujian_kelas1_fam')
        _notice(Icons.info_outline_rounded, 'Syarat kelayakan',
            'Umur tidak melebihi ${text(s['kelas1_max_age'], '32')} tahun pada sesi ${setup.year}, dan telah lulus Kelas III FAM pada tahun ${year - 2} atau lebih awal.'),
      const SectionTitle('Maklumat Bayaran'),
      AppCard(
        color: AppColors.black,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('RM $fee', style: const TextStyle(color: Tw.pahangYellow, fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          DefaultTextStyle.merge(
            style: const TextStyle(color: Colors.white),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: form.fam
                ? [
                    _payRow('Bank', text(s['fam_bank_name'], 'Bank Islam Persatuan Bolasepak Malaysia')),
                    _payRow('No. Akaun', text(s['fam_account_no'], '1213 1010 0061 21')),
                  ]
                : [
                    _payRow('Nama Akaun', text(s['payment_account_name'])),
                    _payRow('Bank', text(s['payment_bank_name'])),
                    _payRow('No. Akaun', text(s['payment_account_no'])),
                  ]),
          ),
          const SizedBox(height: 8),
          Text(form.fam ? 'Bayar ke akaun FAM dan muat naik resit di bawah.' : 'Sila buat bayaran dan muat naik resit di bawah.',
              style: const TextStyle(color: Colors.white60, fontSize: 12.5)),
        ]),
      ),
      const SectionTitle('Maklumat Pemohon'),
      AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          row('Nama', text(p['nama_penuh'])),
          row('No. KP', text(p['no_ic'])),
          row('Telefon', text(p['no_telefon'])),
          row('Emel', text(p['email'])),
          row('Jenis', text(p['jenis_pengadil'])),
          const SizedBox(height: 4),
          const Text('Maklumat ini diambil dari profil anda.', style: TextStyle(fontSize: 12, color: AppColors.muted)),
        ]),
      ),
      ProfileForm(sections: _sections, values: _values),
      const SectionTitle('Dokumen'),
      _fileCard(
        icon: Icons.receipt_long_outlined,
        title: form.fam ? 'Resit Bayaran FAM *' : 'Resit Bayaran *',
        subtitle: _resit == null ? 'PDF / JPG / PNG, maksimum 5MB' : '${_resit!.$2} · ${(_resit!.$1.length / 1024).ceil()} KB',
        done: _resit != null,
        onTap: _pickResit,
      ),
      if (form.annual)
        _fileCard(
          icon: Icons.account_box_outlined,
          title: 'Gambar Profil Terbaru *',
          subtitle: _gambar == null ? 'Gambar berukuran pasport, 400×400' : 'Dipilih · ${(_gambar!.length / 1024).ceil()} KB',
          done: _gambar != null,
          preview: _gambar,
          onTap: _pickGambar,
        ),
      if (form.referee) ...[
        const SectionTitle('Deklarasi Kesihatan'),
        const Padding(
          padding: EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text('Pendaftaran tahunan merangkumi ujian kecergasan fizikal. Sila buat deklarasi berikut:',
              style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
        ),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            for (final (i, (title, body)) in _healthItems.indexed)
              _check(_health[i], (v) => setState(() => _health[i] = v), title: title, body: body),
          ]),
        ),
      ],
      const SectionTitle('Perakuan Pemohon'),
      AppCard(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(children: [
          for (var i = 0; i < (form.annual ? 3 : 2); i++)
            _check(_declare[i], (v) => setState(() => _declare[i] = v), body: _declarations[i]),
        ]),
      ),
      const SizedBox(height: 8),
      FilledButton.icon(
        onPressed: _busy ? null : _submit,
        icon: _busy
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(_busy ? 'Menghantar...' : 'Hantar Permohonan'),
      ),
    ];
  }

  Widget _payRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          SizedBox(width: 90, child: Text(label, style: const TextStyle(color: Colors.white60, fontSize: 13))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );

  Widget _fileCard({required IconData icon, required String title, required String subtitle, required bool done,
          Uint8List? preview, required VoidCallback onTap}) =>
      AppCard(
        onTap: _busy ? null : onTap,
        child: Row(children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: done ? Tw.emerald50 : AppColors.yellowSoft, borderRadius: BorderRadius.circular(14)),
            clipBehavior: Clip.antiAlias,
            child: preview != null
                ? Image.memory(preview, fit: BoxFit.cover)
                : Icon(done ? Icons.check_rounded : icon, color: done ? Tw.emerald700 : AppColors.black),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
            ]),
          ),
          Text(done ? 'Tukar' : 'Pilih', style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
      );

  Widget _check(bool value, ValueChanged<bool> onChanged, {String? title, required String body}) => CheckboxListTile(
        value: value,
        onChanged: (v) => onChanged(v ?? false),
        controlAffinity: ListTileControlAffinity.leading,
        activeColor: AppColors.black,
        checkColor: Tw.pahangYellow,
        dense: true,
        title: Text.rich(TextSpan(children: [
          if (title != null) TextSpan(text: '$title: ', style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(text: body),
        ]), style: const TextStyle(fontSize: 13, height: 1.45)),
      );

  Widget _historyRow(Map<String, dynamic> a) {
    final status = text(a['status_workflow'] ?? a['status']);
    final notes = text(a['pp_notes'] ?? a['admin_notes'], '');
    return AppCard(
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Sesi ${text(a['tahun_permohonan'])}', style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(text(a['tarikh_hantar']), style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
            if (notes.isNotEmpty) Text(notes, style: const TextStyle(fontSize: 12.5)),
            const SizedBox(height: 6),
            Pill(status, applicationTone(status)),
          ]),
        ),
        if (registrationPdfType(a) != null)
          IconButton(
            tooltip: 'Muat turun PDF',
            onPressed: () => downloadApplicationPdf(context, a),
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
      ]),
    );
  }
}

const _healthItems = [
  ('Status Kesihatan',
      'Saya berada dalam keadaan kesihatan fizikal dan mental yang baik. Saya tidak menghidap sebarang penyakit kronik, kecederaan, atau masalah perubatan yang boleh memudaratkan diri saya semasa melakukan aktiviti fizikal berintensiti tinggi.'),
  ('Pemeriksaan Perubatan',
      'Saya telah menjalani pemeriksaan kesihatan dan mendapat pengesahan bahawa saya layak untuk menyertai program latihan dan ujian kecergasan fizikal.'),
  ('Risiko & Tanggungjawab',
      'Saya memahami dan menerima bahawa aktiviti fizikal membawa risiko tertentu. Saya bersetuju untuk mengambil bahagian atas risiko peribadi sendiri dan melepaskan Persatuan Bolasepak Pahang daripada sebarang tuntutan berkaitan kecederaan yang mungkin berlaku.'),
  ('Maklumat Perubatan',
      'Saya bersetuju untuk memberitahu pegawai bertugas sekiranya saya menghidap sebarang kondisi perubatan, alahan, atau sedang mengambil ubat-ubatan yang mungkin mempengaruhi prestasi semasa ujian kecergasan.'),
  ('Kebenaran Rawatan Kecemasan',
      'Sekiranya berlaku kecemasan perubatan semasa ujian kecergasan, saya memberi kebenaran kepada pegawai perubatan atau penganjur untuk mendapatkan rawatan yang diperlukan bagi pihak saya.'),
];

const _declarations = [
  'Saya dengan ini memperakui bahawa semua maklumat yang diberikan dalam borang ini adalah benar dan tepat mengikut pengetahuan saya.',
  'Saya memahami bahawa sebarang maklumat yang tidak benar atau palsu boleh menyebabkan permohonan ini ditolak atau dibatalkan tanpa notis.',
  'Saya bersetuju untuk mematuhi semua peraturan, arahan, dan etika pengadilan yang ditetapkan oleh Persatuan Bolasepak Pahang dan Persatuan Bolasepak Malaysia (FAM).',
];

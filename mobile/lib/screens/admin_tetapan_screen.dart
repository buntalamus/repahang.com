import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../config.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Application windows: (key prefix, title, form).
const _windows = [
  ('registration', 'Daftar Akaun Baru', 'Halaman /daftar'),
  ('berdaftar', 'Pendaftaran Tahunan', 'R1 + R2 + R4'),
  ('bertulis', 'Ujian Kelas III FAM', 'R11 Bertulis'),
  ('kelas1', 'Ujian Kelas I FAM', 'Ujian Kelas I'),
  ('penilai', 'Pendaftaran Penilai', 'R1 Penilai'),
];

/// Text and number settings by section: (key, label, numeric).
const _fields = [
  ('Maklumat Bayaran & Sesi', [
    ('application_year', 'Tahun sesi permohonan', true),
    ('payment_amount', 'Yuran pendaftaran tahunan (RM)', true),
    ('payment_bank_name', 'Bank (tahunan)', false),
    ('payment_account_name', 'Nama akaun (tahunan)', false),
    ('payment_account_no', 'No. akaun (tahunan)', false),
    ('registration_fee', 'Yuran daftar akaun Penilai (RM)', true),
    ('registration_bank_name', 'Bank (daftar akaun)', false),
    ('registration_account_name', 'Nama akaun (daftar akaun)', false),
    ('registration_account_no', 'No. akaun (daftar akaun)', false),
  ]),
  ('Syarat & Kelayakan', [
    ('min_verified_matches', 'Minimum perlawanan disahkan', true),
    ('max_applications_per_year', 'Maksimum permohonan setahun', true),
  ]),
  ('Tetapan Peperiksaan FAM', [
    ('fam_bank_name', 'Bank FAM', false),
    ('fam_account_no', 'No. akaun FAM', false),
    ('bertulis_fee', 'Yuran Kelas III (RM)', true),
    ('bertulis_min_age', 'Umur minimum Kelas III', true),
    ('bertulis_max_age', 'Umur maksimum Kelas III', true),
    ('kelas1_fee', 'Yuran Kelas I (RM)', true),
    ('kelas1_max_age', 'Umur maksimum Kelas I', true),
    ('kelas1_min_fitness_rounds', 'Minimum pusingan kecergasan Kelas I', true),
  ]),
];

/// Admin system settings (/api/admin-settings.php) and the Telegram link
/// email blast (/api/admin-telegram-blast.php) — /admin/tetapan.
class AdminTetapanScreen extends StatefulWidget {
  const AdminTetapanScreen({super.key});

  @override
  State<AdminTetapanScreen> createState() => _AdminTetapanScreenState();
}

class _AdminTetapanScreenState extends State<AdminTetapanScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, String>>>();
  final _controllers = <String, TextEditingController>{};
  Map<String, String> _settings = {};
  bool _saving = false;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<Map<String, String>> _load() async {
    final body = await Api.instance.get('/api/admin-settings.php');
    final settings = {
      for (final e in Map<String, dynamic>.from(body['settings'] as Map? ?? {}).entries) e.key: '${e.value ?? ''}',
    };
    _settings = settings;
    for (final (_, fields) in _fields) {
      for (final (key, _, _) in fields) {
        (_controllers[key] ??= TextEditingController()).text = settings[key] ?? '';
      }
    }
    return settings;
  }

  bool _on(String key) => _settings[key] == '1';

  /// Saves one switch at once, as the website's quick save does.
  Future<void> _quickSave(String key, bool on, {required String title, required String message}) async {
    final ok = await confirmSheet(context, title: title, message: message, confirmLabel: on ? 'Hidupkan' : 'Matikan',
        color: on ? Tw.rose600 : AppColors.black, textColor: on ? Colors.white : Tw.pahangYellow);
    if (!ok) return;
    try {
      final result = await Api.instance.post('/api/admin-settings.php', {key: on ? '1' : '0'});
      if (mounted) showToast(context, text(result['message'], 'Tetapan disimpan.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  Future<void> _saveAll() async {
    FocusScope.of(context).unfocus();
    final body = <String, dynamic>{..._settings};
    body.remove('maintenance_mode');
    body.remove('demo_enabled');
    for (final e in _controllers.entries) {
      body[e.key] = e.value.text.trim();
    }
    setState(() => _saving = true);
    try {
      final result = await Api.instance.post('/api/admin-settings.php', body);
      if (mounted) showToast(context, text(result['message'], 'Tetapan berjaya dikemaskini.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reset() async {
    final ok = await confirmSheet(context, title: 'Reset ke nilai lalai?',
        message: 'Reset semua tetapan kepada nilai lalai? Semua borang permohonan akan ditutup dan mod penyelenggaraan dimatikan.',
        confirmLabel: 'Reset', color: Tw.rose600, textColor: Colors.white);
    if (!ok) return;
    try {
      final result = await Api.instance.delete('/api/admin-settings.php');
      if (mounted) showToast(context, text(result['message'], 'Tetapan telah direset.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  /// DIBUKA / AKAN DIBUKA / TAMAT / DITUTUP, as application-window.ts decides.
  (String, Tone) _windowState(String prefix) {
    if (!_on('${prefix}_open')) return ('DITUTUP', (AppColors.grey100, Tw.gray600));
    final today = DateTime.now().toUtc().add(const Duration(hours: 8)).toIso8601String().substring(0, 10);
    final from = _settings['${prefix}_open_date'] ?? '';
    final to = _settings['${prefix}_close_date'] ?? '';
    if (from.isNotEmpty && today.compareTo(from) < 0) return ('AKAN DIBUKA ${formatDate(from)}', (Tw.amber50, Tw.amber700));
    if (to.isNotEmpty && today.compareTo(to) > 0) return ('TAMAT ${formatDate(to)}', (Tw.rose50, Tw.rose700));
    return ('DIBUKA', (Tw.emerald50, Tw.emerald700));
  }

  Future<void> _pickDate(String key) async {
    final current = DateTime.tryParse(_settings[key] ?? '');
    final picked = await showDatePicker(context: context, initialDate: current ?? DateTime.now(),
        firstDate: DateTime(2020), lastDate: DateTime(2040));
    if (picked == null) return;
    setState(() => _settings[key] = picked.toIso8601String().substring(0, 10));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tetapan')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _saving ? null : _saveAll,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                : const Text('Simpan Semua Tetapan'),
          ),
        ),
      ),
      body: AsyncView<Map<String, String>>(
        key: _view,
        load: _load,
        builder: (context, _, reload) => RefreshList(onRefresh: reload, children: [
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              SwitchListTile(
                title: const Text('Mod Penyelenggaraan', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Apabila aktif, hanya Admin boleh akses sistem.', style: TextStyle(fontSize: 12.5)),
                value: _on('maintenance_mode'),
                activeTrackColor: Tw.rose600,
                onChanged: (on) => _quickSave('maintenance_mode', on,
                    title: on ? 'Hidupkan mod penyelenggaraan?' : 'Matikan mod penyelenggaraan?',
                    message: on ? 'Semua pengguna kecuali Admin tidak dapat mengakses sistem sehingga dimatikan.'
                        : 'Semua pengguna boleh mengakses sistem semula.'),
              ),
              if (!demoMode.value) ...[
                const Divider(indent: 16),
                SwitchListTile(
                  title: const Text('Sistem Demo (demo.refpahang.com)', style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: const Text('Apabila dimatikan, demo ditutup untuk semua dalam masa 30 saat.',
                      style: TextStyle(fontSize: 12.5)),
                  value: _on('demo_enabled'),
                  activeTrackColor: AppColors.black,
                  onChanged: (on) => _quickSave('demo_enabled', on,
                      title: on ? 'Buka sistem demo?' : 'Tutup sistem demo?',
                      message: on ? 'demo.refpahang.com akan dibuka untuk latihan.' : 'demo.refpahang.com akan ditutup untuk semua pengguna.'),
                ),
              ],
            ]),
          ),
          const SectionTitle('Status Penerimaan Permohonan'),
          for (final (prefix, title, form) in _windows) _windowCard(prefix, title, form),
          for (final (section, fields) in _fields) ...[
            SectionTitle(section),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final (key, label, numeric) in fields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextField(
                      controller: _controllers[key],
                      keyboardType: numeric ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
                      inputFormatters: numeric ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))] : null,
                      decoration: InputDecoration(labelText: label),
                    ),
                  ),
                if (section == 'Syarat & Kelayakan') ...[
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Profil mesti lengkap sebelum memohon'),
                    value: _on('require_profile_complete'),
                    activeTrackColor: AppColors.black,
                    onChanged: (on) => setState(() => _settings['require_profile_complete'] = on ? '1' : '0'),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Pautkan rekod perlawanan secara automatik'),
                    value: _on('auto_link_matches'),
                    activeTrackColor: AppColors.black,
                    onChanged: (on) => setState(() => _settings['auto_link_matches'] = on ? '1' : '0'),
                  ),
                ],
              ]),
            ),
          ],
          const SectionTitle('Pautan Telegram Pengguna'),
          const _TelegramBlastCard(),
          const SizedBox(height: 16),
          TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: Tw.rose600),
            onPressed: _reset,
            icon: const Icon(Icons.restart_alt_rounded, size: 18),
            label: const Text('Reset ke nilai lalai'),
          ),
        ]),
      ),
    );
  }

  Widget _windowCard(String prefix, String title, String form) {
    final (label, tone) = _windowState(prefix);
    Widget date(String key, String hint) => Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 10)),
            onPressed: () => _pickDate(key),
            onLongPress: () => setState(() => _settings[key] = ''),
            icon: const Icon(Icons.event_outlined, size: 16),
            label: Text((_settings[key] ?? '').isEmpty ? hint : formatDate(_settings[key]), style: const TextStyle(fontSize: 13)),
          ),
        );
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(form, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 4),
              Pill(label, tone),
            ]),
          ),
          Switch(
            value: _on('${prefix}_open'),
            activeTrackColor: AppColors.black,
            activeThumbColor: Tw.pahangYellow,
            onChanged: (on) => setState(() => _settings['${prefix}_open'] = on ? '1' : '0'),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [date('${prefix}_open_date', 'Tarikh buka'), const SizedBox(width: 8), date('${prefix}_close_date', 'Tarikh tutup')]),
        const Padding(
          padding: EdgeInsets.only(top: 4),
          child: Text('Tekan lama untuk kosongkan tarikh.', style: TextStyle(fontSize: 11, color: AppColors.faint)),
        ),
      ]),
    );
  }
}

/// Email blast of Telegram link invitations to every unlinked user.
class _TelegramBlastCard extends StatefulWidget {
  const _TelegramBlastCard();

  @override
  State<_TelegramBlastCard> createState() => _TelegramBlastCardState();
}

class _TelegramBlastCardState extends State<_TelegramBlastCard> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  bool _busy = false;

  Future<void> _post(Map<String, dynamic> body) async {
    setState(() => _busy = true);
    try {
      final result = await Api.instance.post('/api/admin-telegram-blast.php', body);
      if (mounted) showToast(context, text(result['message'], 'Berjaya.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      load: () => Api.instance.get('/api/admin-telegram-blast.php'),
      builder: (context, d, reload) {
        int n(Object? v) => int.tryParse('${v ?? ''}') ?? 0;
        final batch = d['batch'] == null ? null : Map<String, dynamic>.from(d['batch'] as Map);
        final counts = Map<String, dynamic>.from(batch?['counts'] as Map? ?? {});
        final queued = batch?['status'] == 'queued';
        final retryable = n(counts['failed']) + n(counts['uncertain']);
        final total = n(d['not_linked']);
        final inactive = n(d['inactive_not_linked']);
        return AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: MiniStat(label: 'Dipaut', value: d['linked'], color: Tw.emerald500)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Belum dipaut', value: total, color: AppColors.black)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Tidak aktif', value: inactive, color: AppColors.grey200)),
            ]),
            if (batch != null) ...[
              const SizedBox(height: 12),
              Text('Blast terakhir: ${const {'queued': 'Sedang berjalan', 'completed': 'Selesai', 'cancelled': 'Dibatalkan'}[batch['status']] ?? text(batch['status'])}'
                  ' · ${text(batch['created_by_name'])} · ${text(batch['created_at'])}',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
              Text('Dihantar ${n(counts['sent'])} · Menunggu ${n(counts['pending']) + n(counts['processing'])} · '
                  'Gagal ${n(counts['failed'])} · Belum pasti ${n(counts['uncertain'])}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
            ],
            const SizedBox(height: 12),
            if (queued)
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: Tw.rose600),
                onPressed: _busy ? null : () async {
                  final ok = await confirmSheet(context, title: 'Batalkan blast?',
                      message: 'Batalkan blast? Emel yang belum dihantar tidak akan dihantar.', confirmLabel: 'Batalkan blast',
                      color: Tw.rose600, textColor: Colors.white);
                  if (ok) await _post({'action': 'cancel', 'id': batch!['id']});
                },
                child: const Text('Batalkan Blast'),
              )
            else
              FilledButton(
                onPressed: _busy || total == 0 ? null : () async {
                  final ok = await confirmSheet(context, title: 'Mulakan blast emel?',
                      message: 'Mulakan blast emel pautan Telegram kepada $total pengguna, termasuk $inactive akaun tidak aktif? '
                          'Emel dihantar 10 setiap 5 minit, anggaran ${(total / 10).ceil() * 5} minit.',
                      confirmLabel: 'Mulakan');
                  if (ok) await _post({'action': 'start'});
                },
                child: const Text('Mulakan Blast Emel'),
              ),
            if (batch != null && !queued && retryable > 0)
              TextButton(
                onPressed: _busy ? null : () async {
                  final ok = await confirmSheet(context, title: 'Hantar semula?',
                      message: 'Hantar semula $retryable emel yang gagal atau belum pasti? Penerima yang statusnya belum pasti '
                          'mungkin menerima emel kali kedua.',
                      confirmLabel: 'Hantar semula');
                  if (ok) await _post({'action': 'retry-failed', 'id': batch['id']});
                },
                child: const Text('Hantar Semula Gagal / Belum Pasti'),
              ),
          ]),
        );
      },
    );
  }
}

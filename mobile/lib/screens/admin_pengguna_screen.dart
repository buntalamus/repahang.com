import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/profile_form.dart';

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

bool _active(Map<String, dynamic> u) => !const ['0', 'false'].contains('${u['is_active'] ?? u['aktif']}');

const _roles = [('Pengadil', 'Pengadil'), ('Penilai', 'Penilai Pengadil'), ('PP Daerah', 'PP Daerah'), ('Admin', 'Admin')];

String _roleLabel(Object? role) => _roles.where((r) => r.$1 == '$role').map((r) => r.$2).firstOrNull ?? text(role);

/// Admin: every account (/api/admin-users.php) with add, edit, reset
/// password, (de)activate and Telegram unlink — /admin/pengguna. With
/// [role] it lists one role only, e.g. /admin/pp-daerah.
class AdminPenggunaScreen extends StatefulWidget {
  const AdminPenggunaScreen({super.key, this.role});
  final String? role;

  @override
  State<AdminPenggunaScreen> createState() => _AdminPenggunaScreenState();
}

class _AdminPenggunaScreenState extends State<AdminPenggunaScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  late String _role = widget.role ?? 'semua';
  String _status = 'aktif';
  String _query = '';
  List<(Object, String)> _associations = const [];

  Future<void> _open(Map<String, dynamic> u) async {
    final changed = await showAppSheet<bool>(context,
        builder: (_) => _UserSheet(userId: int.parse('${u['id']}'), associations: _associations));
    if (changed == true) await _view.currentState?.reload();
  }

  Future<void> _add() async {
    final changed = await showAppSheet<bool>(context, title: 'Tambah pengguna',
        builder: (_) => _UserForm(associations: _associations, role: widget.role ?? 'Pengadil'));
    if (changed == true) await _view.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.role == 'PP Daerah' ? 'Pegawai Pembangunan Daerah' : 'Pengguna')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.person_add_alt_rounded),
        label: const Text('Tambah'),
      ),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        load: () => Api.instance.get('/api/admin-users.php'),
        builder: (context, body, reload) {
          _associations = [
            for (final p in _rows(body['persatuan'])) (int.tryParse('${p['id']}') ?? 0, text(p['nama_persatuan'])),
          ];
          final all = _rows(body['users']).where((u) => widget.role == null || u['user_role'] == widget.role).toList();
          final q = _query.toLowerCase();
          final shown = all.where((u) {
            if (_role != 'semua' && u['user_role'] != _role) return false;
            if (_status == 'aktif' && !_active(u)) return false;
            if (_status == 'tidak' && _active(u)) return false;
            return q.isEmpty || '${u['nama_penuh']} ${u['email']} ${u['no_ic']} ${u['persatuan_nama']}'.toLowerCase().contains(q);
          }).toList();
          final inactive = all.where((u) => !_active(u)).length;
          return RefreshList(onRefresh: reload, bottomPadding: 96, children: [
            Row(children: [
              Expanded(child: MiniStat(label: 'Jumlah', value: all.length)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Aktif', value: all.length - inactive, color: Tw.emerald500)),
              const SizedBox(width: 8),
              Expanded(child: MiniStat(label: 'Tidak aktif', value: inactive, color: AppColors.grey200)),
            ]),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Cari nama, emel, No. KP atau persatuan',
                  prefixIcon: Icon(Icons.search_rounded)),
              onChanged: (v) => setState(() => _query = v.trim()),
            ),
            const SizedBox(height: 8),
            if (widget.role == null)
              FilterChips<String>(
                options: [('semua', 'Semua'), for (final r in _roles) r],
                value: _role,
                onChanged: (v) => setState(() => _role = v),
              ),
            FilterChips<String>(
              options: const [('aktif', 'Aktif'), ('tidak', 'Tidak aktif'), ('semua', 'Semua status')],
              value: _status,
              onChanged: (v) => setState(() => _status = v),
            ),
            const SizedBox(height: 8),
            if (shown.isEmpty)
              const EmptyState(icon: Icons.group_off_outlined, title: 'Tiada pengguna')
            else
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, u) in shown.take(200).indexed) ...[
                    if (i > 0) const Divider(indent: 72),
                    ListTile(
                      onTap: () => _open(u),
                      leading: Avatar(name: text(u['nama_penuh']), photo: u['url_gambar_profil'] as String?, radius: 20),
                      title: Text(text(u['nama_penuh']), maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      subtitle: Text('${_roleLabel(u['user_role'])} · ${text(u['persatuan_nama'], 'Tiada persatuan')}',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      trailing: _active(u) ? null : const Pill('Tidak aktif', (AppColors.grey100, Tw.gray600)),
                    ),
                  ],
                ]),
              ),
            if (shown.length > 200)
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text('Paparan dihadkan kepada 200 pertama. Gunakan carian.', textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: AppColors.muted)),
              ),
          ]);
        },
      ),
    );
  }
}

class _UserSheet extends StatefulWidget {
  const _UserSheet({required this.userId, required this.associations});
  final int userId;
  final List<(Object, String)> associations;

  @override
  State<_UserSheet> createState() => _UserSheetState();
}

class _UserSheetState extends State<_UserSheet> {
  bool _busy = false;

  Future<void> _patch(Map<String, dynamic> body) async {
    setState(() => _busy = true);
    try {
      final result = await Api.instance.patch('/api/admin-users.php', {'userId': widget.userId, ...body});
      if (!mounted) return;
      showToast(context, text(result['message'], 'Berjaya.'));
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resetPassword(String name) async {
    final ok = await confirmSheet(context, title: 'Reset kata laluan',
        message: 'Reset kata laluan untuk $name? Kata laluan baharu (12345678) akan dihantar ke emel pengguna.',
        confirmLabel: 'Reset');
    if (ok) await _patch({'action': 'reset_password'});
  }

  Future<void> _setActive(String name, bool active) async {
    if (active) {
      final ok = await confirmSheet(context, title: 'Aktifkan semula akaun',
          message: 'Aktifkan semula akaun $name? Pengguna perlu log masuk semula. Tempoh 8 bulan bermula semula; '
              'semakan pendaftaran automatik seterusnya pada tahun hadapan.',
          confirmLabel: 'Aktifkan');
      if (ok) await _patch({'action': 'set_account_status', 'aktif': 1});
      return;
    }
    final reason = TextEditingController();
    final ok = await confirmSheet(context, title: 'Tandakan akaun tidak aktif',
        message: '$name tidak boleh log masuk. Semua sejarah permohonan, perlawanan dan laporan dikekalkan.',
        details: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: LabeledField(label: 'Sebab tidak aktif', controller: reason, maxLines: 3, required: true,
              hint: 'Dipaparkan kepada pengguna semasa cubaan log masuk'),
        ),
        confirmLabel: 'Tandakan Tidak Aktif', color: Tw.rose600, textColor: Colors.white);
    final text0 = reason.text.trim();
    reason.dispose();
    if (!ok) return;
    if (text0.isEmpty || text0.length > 1000) {
      if (mounted) showToast(context, 'Sila isi sebab tidak aktif (maksimum 1000 aksara).', ToastType.warning);
      return;
    }
    await _patch({'action': 'set_account_status', 'aktif': 0, 'reason': text0});
  }

  Future<void> _revokeTelegram(String name) async {
    final ok = await confirmSheet(context, title: 'Batalkan pautan Telegram',
        message: 'Batalkan pautan Telegram untuk $name? Pengguna perlu memautkan semula akaun Telegram untuk menerima '
            'mesej melalui Telegram.',
        confirmLabel: 'Batalkan pautan', color: Tw.rose600, textColor: Colors.white);
    if (ok) await _patch({'action': 'revoke_telegram'});
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(
          (await Api.instance.get('/api/admin-users.php', {'id': widget.userId}))['user'] as Map),
      builder: (context, u, _) {
        final name = text(u['nama_penuh']);
        final active = '${u['aktif']}' != '0';
        final linked = text(u['telegram_chat_id'], '').isNotEmpty;
        String join(List<Object?> parts) => parts.map((e) => text(e, '')).where((e) => e.isNotEmpty).join(', ');
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Avatar(name: name, photo: u['url_gambar_profil'] as String?, radius: 26),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  Pill(_roleLabel(u['role']), (AppColors.black, Tw.pahangYellow)),
                  Pill(active ? 'Aktif' : 'Tidak aktif', active ? (Tw.emerald50, Tw.emerald700) : (AppColors.grey100, Tw.gray600)),
                  if (linked) const Pill('Telegram', (Tw.blue50, Tw.blue700)),
                ]),
              ]),
            ),
          ]),
          if (!active && text(u['inactive_reason'], '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Sebab: ${text(u['inactive_reason'])}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          ],
          const SizedBox(height: 8),
          DetailRow(Icons.mail_outline, 'Emel', text(u['email'])),
          DetailRow(Icons.phone_outlined, 'No. telefon', text(u['no_telefon']),
              onTap: () => callNumber(context, text(u['no_telefon'], ''))),
          DetailRow(Icons.badge_outlined, 'No. KP', text(u['no_ic'])),
          DetailRow(Icons.groups_outlined, 'Persatuan', text(u['persatuan_nama'])),
          DetailRow(Icons.home_outlined, 'Alamat', text(join([u['alamat1'], u['alamat2'], u['poskod'], u['daerah'], u['negeri']]))),
          if (text(u['jenis_pengadil'], '').isNotEmpty) DetailRow(Icons.sports_outlined, 'Jenis pengadil', text(u['jenis_pengadil'])),
          DetailRow(Icons.login_rounded, 'Log masuk terakhir', text(u['last_login'])),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy ? null : () async {
              final saved = await showAppSheet<bool>(context, title: 'Kemaskini pengguna',
                  builder: (_) => _UserForm(associations: widget.associations, user: u));
              if (saved == true && context.mounted) Navigator.pop(context, true);
            },
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Kemaskini'),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _resetPassword(name), child: const Text('Reset kata laluan'))),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: active ? Tw.rose600 : Tw.emerald700),
                onPressed: _busy ? null : () => _setActive(name, !active),
                child: Text(active ? 'Tidak aktif' : 'Aktifkan'),
              ),
            ),
          ]),
          if (linked)
            TextButton(
              style: TextButton.styleFrom(foregroundColor: Tw.rose600),
              onPressed: _busy ? null : () => _revokeTelegram(name),
              child: const Text('Batalkan pautan Telegram'),
            ),
        ]);
      },
    );
  }
}

/// Add (multipart POST) or edit (JSON PUT) an account's main fields.
class _UserForm extends StatefulWidget {
  const _UserForm({required this.associations, this.user, this.role = 'Pengadil'});
  final List<(Object, String)> associations;
  final Map<String, dynamic>? user;
  final String role;

  @override
  State<_UserForm> createState() => _UserFormState();
}

class _UserFormState extends State<_UserForm> {
  late final Map<String, dynamic> _values = {
    'nama_penuh': widget.user?['nama_penuh'],
    'email': widget.user?['email'],
    'no_telefon': widget.user?['no_telefon'],
    'no_ic': widget.user?['no_ic'],
    'jantina': widget.user?['jantina'],
    'user_role': widget.user?['role'] ?? widget.role,
    'persatuan_id': int.tryParse('${widget.user?['persatuan_id'] ?? ''}'),
    'jenis_pengadil': widget.user?['jenis_pengadil'],
  };
  bool _busy = false;

  bool get _editing => widget.user != null;

  List<FieldSection> get _sections => [
        FieldSection('Akaun', [
          const FieldSpec('nama_penuh', 'Nama Penuh', required: true, maxLength: 255),
          const FieldSpec('email', 'Emel', kind: FieldKind.email, required: true, maxLength: 254),
          const FieldSpec('no_telefon', 'No. Telefon', kind: FieldKind.phone, maxLength: 15),
          if (_editing) const FieldSpec('no_ic', 'No. Kad Pengenalan', maxLength: 14),
          if (_editing) FieldSpec('jantina', 'Jantina', kind: FieldKind.select, options: FieldSpec.plain(jantinaOptions)),
          FieldSpec('user_role', 'Peranan', kind: FieldKind.select, required: true, options: [for (final r in _roles) (r.$1, r.$2)]),
          FieldSpec('persatuan_id', 'Persatuan (FA Daerah)', kind: FieldKind.select, options: widget.associations,
              required: _values['user_role'] != 'Admin'),
          FieldSpec('jenis_pengadil', 'Jenis Pengadil', kind: FieldKind.select, options: FieldSpec.plain(allJenisPengadil)),
        ]),
      ];

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final problem = validateSections(_sections, _values);
    if (problem != null) {
      showToast(context, problem, ToastType.warning);
      return;
    }
    setState(() => _busy = true);
    try {
      String? clean(Object? v) => v == null || '$v'.trim().isEmpty ? null : '$v'.trim();
      final Map<String, dynamic> result;
      if (_editing) {
        result = await Api.instance.put('/api/admin-users.php', {
          'userId': widget.user!['id'],
          'nama_penuh': clean(_values['nama_penuh']),
          'email': clean(_values['email']),
          'no_telefon': clean(_values['no_telefon']),
          'no_ic': clean(_values['no_ic']),
          'jantina': clean(_values['jantina']),
          'user_role': _values['user_role'],
          'persatuan_id': _values['persatuan_id'],
          'jenis_pengadil': clean(_values['jenis_pengadil']),
        });
      } else {
        result = await Api.instance.postForm('/api/admin-users.php', {
          for (final key in ['nama_penuh', 'email', 'no_telefon', 'user_role', 'persatuan_id', 'jenis_pengadil'])
            if (clean(_values[key]) != null) key: clean(_values[key])!,
        });
      }
      if (!mounted) return;
      final password = text(result['generatedPassword'], '');
      showToast(context, '${text(result['message'], 'Disimpan.')}${password.isEmpty ? '' : ' Kata laluan: $password'}');
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ProfileForm(sections: _sections, values: _values, onChanged: () => setState(() {})),
      if (!_editing)
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('Kata laluan sementara dijana dan dihantar ke emel pengguna.',
              style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
        ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: _busy ? null : _save,
        child: _busy
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
            : Text(_editing ? 'Simpan' : 'Tambah pengguna'),
      ),
    ]);
  }
}

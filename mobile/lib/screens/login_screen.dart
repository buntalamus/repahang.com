import 'package:flutter/material.dart';

import '../api.dart';
import '../push.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// The website's login page (features/auth/login): greyscale photo background,
/// white card with the form and a black announcement panel.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hidden = true;
  String? _error;
  List<Map<String, dynamic>> _announcements = [];
  int _current = 0;

  @override
  void initState() {
    super.initState();
    Api.instance.get('/api/public-announcements.php').then((body) {
      if (!mounted) return;
      setState(() => _announcements =
          (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList());
    }, onError: (_) {});
  }

  Future<void> _submit() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Emel dan kata laluan diperlukan.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Api.instance.login(_email.text.trim(), _password.text);
      await PushService.instance.register();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Tw.slate900,
      body: Stack(fit: StackFit.expand, children: [
        // bg.jpg with grayscale(100%) brightness(0.6), then the slate gradient.
        ColorFiltered(
          colorFilter: const ColorFilter.matrix([
            0.1278, 0.4302, 0.0420, 0, 0,
            0.1278, 0.4302, 0.0420, 0, 0,
            0.1278, 0.4302, 0.0420, 0, 0,
            0, 0, 0, 1, 0,
          ]),
          child: Image.asset('assets/images/bg.jpg', fit: BoxFit.cover),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xB30F172A), Color(0xCC1E293B)],
            ),
          ),
        ),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 50, offset: Offset(0, 25))],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [_form(), _aside()]),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _form() {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: AutofillGroup(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Image.asset('assets/images/logo-pahang.png', width: 56, height: 56),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('LOG MASUK',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: Tw.pahangBlack)),
                Text('Sistem Pengurusan Pengadil Negeri Pahang', style: TextStyle(fontSize: 14, color: Tw.gray500)),
              ]),
            ),
          ]),
          const SizedBox(height: 24),
          const Text('Log masuk dashboard Pengadil',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: Tw.gray900)),
          const SizedBox(height: 24),
          const FieldLabel('Emel'),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 16),
          const FieldLabel('Kata Laluan'),
          TextField(
            controller: _password,
            obscureText: _hidden,
            autofillHints: const [AutofillHints.password],
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              suffixIcon: IconButton(
                icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: Tw.gray400, size: 20),
                onPressed: () => setState(() => _hidden = !_hidden),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => openWebsite(context, '/lupa-kata-laluan'),
              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28)),
              child: const Text('Lupa kata laluan?', style: TextStyle(fontSize: 12, color: Tw.gray500)),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 4),
            Text(_error!, style: const TextStyle(fontSize: 14, color: Tw.red600)),
          ],
          const SizedBox(height: 12),
          BlackButton(label: _busy ? 'Mengelog masuk...' : 'Log Masuk', busy: _busy, onPressed: _submit),
          const SizedBox(height: 24),
          const Text(
            'Hanya pegawai yang dibenarkan boleh mengakses panel ini. '
            'Sila hubungi pentadbir sistem jika anda menghadapi masalah log masuk.',
            style: TextStyle(fontSize: 12, color: Tw.gray400),
          ),
        ]),
      ),
    );
  }

  Widget _aside() {
    final announcement = _announcements.isEmpty ? null : _announcements[_current];
    return Container(
      color: Tw.pahangBlack,
      padding: const EdgeInsets.all(32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('PENGUMUMAN',
            style: TextStyle(color: Tw.pahangYellow, fontSize: 12, letterSpacing: 6.4, fontWeight: FontWeight.w400)),
        const SizedBox(height: 12),
        if (announcement != null) ...[
          Text(text(announcement['title']),
              maxLines: 2, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.35)),
          const SizedBox(height: 8),
          Text(text(announcement['content'], ''),
              maxLines: 5, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 14, height: 1.6)),
          const SizedBox(height: 8),
          Text(text(announcement['created_at_formatted'], ''), style: const TextStyle(color: Color(0x66FFFFFF), fontSize: 12)),
          if (_announcements.length > 1) ...[
            const SizedBox(height: 12),
            Row(children: [
              _roundButton(Icons.chevron_left,
                  () => setState(() => _current = (_current - 1 + _announcements.length) % _announcements.length)),
              const SizedBox(width: 12),
              Text('${_current + 1} / ${_announcements.length}', style: const TextStyle(color: Color(0x80FFFFFF), fontSize: 12)),
              const SizedBox(width: 12),
              _roundButton(Icons.chevron_right, () => setState(() => _current = (_current + 1) % _announcements.length)),
            ]),
          ],
        ] else ...[
          const Text('Sistem Pengurusan Pengadil Negeri Pahang',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.35)),
          const SizedBox(height: 8),
          const Text('Selamat datang ke sistem pengurusan pengadil PBNP. Sila log masuk untuk mengakses dashboard anda.',
              style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 14, height: 1.6)),
        ],
        const SizedBox(height: 24),
        Material(
          color: Tw.pahangYellow,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: () => openWebsite(context, '/daftar'),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text('Daftar Akaun Baharu',
                    style: TextStyle(color: Tw.pahangBlack, fontSize: 14, fontWeight: FontWeight.w600)),
                SizedBox(width: 8),
                Icon(Icons.arrow_forward, size: 16, color: Tw.pahangBlack),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Text('Pastikan maklumat peribadi yang diberikan adalah tepat, lengkap, dan terkini.',
            style: TextStyle(color: Color(0x99FFFFFF), fontSize: 12)),
      ]),
    );
  }

  Widget _roundButton(IconData icon, VoidCallback onTap) => Material(
        color: const Color(0x1AFFFFFF),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 28, height: 28, child: Icon(icon, size: 16, color: Colors.white)),
        ),
      );
}

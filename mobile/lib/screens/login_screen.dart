import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../config.dart';
import '../push.dart';
import '../theme.dart';
import '../widgets/common.dart';

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
  Map<String, dynamic>? _announcement;
  List<Map<String, dynamic>> _demoAccounts = const [];
  String? _demoClosed;

  @override
  void initState() {
    super.initState();
    _loadServerInfo();
  }

  void _loadServerInfo() {
    _announcement = null;
    _demoAccounts = const [];
    _demoClosed = null;
    Api.instance.get('/api/public-announcements.php').then((body) {
      final list = body['data'] as List? ?? [];
      if (mounted && list.isNotEmpty) setState(() => _announcement = Map<String, dynamic>.from(list.first as Map));
    }, onError: (_) {});
    if (!demoMode.value) return;
    Api.instance.get('/api/demo-info.php').then((body) {
      final list = (body['accounts'] as List? ?? []).map((a) => Map<String, dynamic>.from(a as Map)).toList();
      if (mounted) {
        setState(() {
          _demoAccounts = body['open'] == false ? const [] : list;
          _demoClosed = body['open'] == false ? text(body['message'], 'Sistem demo sedang ditutup.') : null;
        });
      }
    }, onError: (_) {});
  }

  Future<void> _switchServer(bool demo) async {
    if (demo) {
      final ok = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
        title: const Text('Cuba Sistem Demo?'),
        content: const Text('App akan bertukar ke demo.refpahang.com: sistem latihan dengan data rekaan. '
            'Akaun dan data sebenar anda tidak terlibat. Anda boleh kembali ke sistem sebenar bila-bila masa.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Buka Demo')),
        ],
      ));
      if (ok != true) return;
    }
    await PushService.instance.stop();
    await Api.instance.switchServer(demo);
    if (!mounted) return;
    setState(() {
      _error = null;
      _email.clear();
      _password.clear();
      _loadServerInfo();
    });
  }

  void _useDemoAccount(Map<String, dynamic> account) {
    _email.text = text(account['emel']);
    _password.text = text(account['kata_laluan']);
    _submit();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
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
      if (mounted) {
        setState(() => _error = error.message);
        if (error.code == 'ACCOUNT_INACTIVE') {
          setState(() => _busy = false);
          await showDialog<void>(context: context, builder: (dialogContext) => AlertDialog(
            title: const Text('Akaun Tidak Aktif'),
            scrollable: true,
            content: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(error.message),
              const SizedBox(height: 16),
              const Text('Sebab Tidak Aktif', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(error.reason ?? 'Sila hubungi pentadbir untuk maklumat lanjut.'),
              const SizedBox(height: 16),
              const Text('Sila hubungi pentadbir untuk mengaktifkan semula akaun.'),
            ]),
            actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Tutup'))],
          ));
        }
      }
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
      backgroundColor: AppColors.black,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Column(children: [
                  const SizedBox(height: 32),
                  Image.asset('assets/images/logo-pahang.png', width: 96, height: 96),
                  const SizedBox(height: 16),
                  const Text('RefPahang', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  const Text('Sistem Pengurusan Pengadil PBNP', style: TextStyle(color: Colors.white60, fontSize: 14)),
                  if (_announcement != null)
                    Container(
                      margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(14)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Icon(Icons.campaign_rounded, color: Tw.pahangYellow, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(text(_announcement!['title']), maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                            Text(text(_announcement!['content'], ''), maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white70, fontSize: 13)),
                          ]),
                        ),
                      ]),
                    ),
                  const SizedBox(height: 28),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + MediaQuery.of(context).padding.bottom),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      child: AutofillGroup(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          if (demoMode.value) ...[
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFFFDBA74))),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                                const Text('🧪 Mod Demo: data rekaan', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF9A3412))),
                                const SizedBox(height: 4),
                                Text(_demoClosed ?? 'Pilih peranan untuk log masuk terus.',
                                    style: const TextStyle(fontSize: 13, color: Color(0xFF9A3412))),
                                const SizedBox(height: 10),
                                for (final account in _demoAccounts)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: OutlinedButton(
                                      onPressed: _busy ? null : () => _useDemoAccount(account),
                                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44), alignment: Alignment.centerLeft),
                                      child: Text(text(account['peranan']), style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ),
                                  ),
                                TextButton(onPressed: _busy ? null : () => _switchServer(false),
                                    child: const Text('Keluar mod demo (kembali ke sistem sebenar)')),
                              ]),
                            ),
                            const SizedBox(height: 20),
                          ],
                          const Text('Log masuk', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          const Text('Guna akaun yang sama seperti di website.', style: TextStyle(color: AppColors.muted)),
                          const SizedBox(height: 24),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.email],
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              hintText: 'Emel',
                              prefixIcon: Icon(Icons.mail_outline_rounded),
                              fillColor: AppColors.background,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password,
                            obscureText: _hidden,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _submit(),
                            decoration: InputDecoration(
                              hintText: 'Kata laluan',
                              prefixIcon: const Icon(Icons.lock_outline_rounded),
                              fillColor: AppColors.background,
                              suffixIcon: IconButton(
                                icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                onPressed: () => setState(() => _hidden = !_hidden),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () => openWebsite(context, '/lupa-kata-laluan'),
                              child: const Text('Lupa kata laluan?', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                            ),
                          ),
                          if (_error != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: Tw.rose50, borderRadius: BorderRadius.circular(12)),
                              child: Row(children: [
                                const Icon(Icons.error_outline_rounded, color: Tw.rose600, size: 20),
                                const SizedBox(width: 8),
                                Expanded(child: Text(_error!, style: const TextStyle(color: Tw.rose700, fontSize: 14))),
                              ]),
                            ),
                            const SizedBox(height: 12),
                          ],
                          FilledButton(
                            onPressed: _busy ? null : _submit,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                            child: _busy
                                ? const SizedBox(width: 22, height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Tw.pahangYellow))
                                : const Text('Log masuk', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          ),
                          const Spacer(),
                          const SizedBox(height: 16),
                          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Text('Belum ada akaun?', style: TextStyle(color: AppColors.muted)),
                            TextButton(onPressed: () => openWebsite(context, '/daftar'), child: const Text('Daftar')),
                          ]),
                          if (!demoMode.value && !kIsWeb)
                            TextButton.icon(
                              onPressed: _busy ? null : () => _switchServer(true),
                              icon: const Icon(Icons.science_outlined, size: 18),
                              label: const Text('Cuba Sistem Demo'),
                              style: TextButton.styleFrom(foregroundColor: AppColors.muted),
                            ),
                        ]),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

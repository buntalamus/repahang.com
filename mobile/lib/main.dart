import 'package:flutter/material.dart';

import 'api.dart';
import 'config.dart';
import 'push.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadServerChoice();
  await PushService.instance.init();
  await Api.instance.restore();
  // A restored session re-sends the device token, which may have changed.
  if (Api.instance.user.value != null) PushService.instance.register();
  runApp(const RefPahangApp());
}

class RefPahangApp extends StatelessWidget {
  const RefPahangApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RefPahang',
      builder: (context, child) => Listener(
        onPointerDown: (_) => Api.instance.recordActivity(),
        child: Focus(onKeyEvent: (_, _) { Api.instance.recordActivity(); return KeyEventResult.ignored; },
          child: ValueListenableBuilder<bool>(
            valueListenable: demoMode,
            builder: (context, demo, inner) => demo
                ? Banner(message: 'DEMO', location: BannerLocation.topEnd, color: const Color(0xFFF97316), child: inner)
                : inner!,
            child: child ?? const SizedBox.shrink(),
          )),
      ),
      debugShowCheckedModeBanner: false,
      // The website has no dark theme; the app matches it.
      theme: buildTheme(),
      home: ValueListenableBuilder<SessionUser?>(
        valueListenable: Api.instance.user,
        builder: (context, user, _) => user == null ? const LoginScreen() : const HomeShell(),
      ),
    );
  }
}

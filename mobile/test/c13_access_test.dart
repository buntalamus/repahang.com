import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/screens/utama_screen.dart';
import 'package:refpahang/screens/tugasan_screen.dart';
import 'package:refpahang/theme.dart';
import 'package:refpahang/widgets/c13_button.dart';

void main() {
  const match = '01234567-1234-1234-1234-0123456789ab';
  late Interceptor interceptor;
  String? opened;
  var eligible = true, submitted = false, launches = 0;
  setUp(() {
    opened = null; eligible = true; submitted = false; launches = 0;
    Api.instance.user.value = SessionUser({'id': 1, 'role': 'Pengadil', 'nama_penuh': 'PENGADIL UJIAN'});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/url_launcher'), (call) async {
        if (call.method == 'launch' || call.method == 'launchUrl') opened = (call.arguments as Map)['url'] as String?;
        return true;
      });
    interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      Map<String, dynamic> body = {'error': false};
      if (options.path.contains('jfa-c13.php')) {
        launches++;
        expect(options.method, 'POST');
        expect(options.uri.queryParameters['match'], match);
        expect(options.uri.queryParameters['view'], 'launch');
        body['url'] = Api.instance.absoluteUrl('/api/jfa-c13.php?view=open&ticket=EXAMPLE');
      } else if (options.path.endsWith('portal-dashboard.php')) {
        body['data'] = {'totals': {}, 'c13': eligible ? [{'match_id': match, 'label': '03 · ALFA lwn BRAVO', 'submitted': submitted}] : []};
      } else if (options.path.endsWith('tugasan.php')) {
        body['data'] = [{'id': 1, 'jawatan': 'Pengadil', 'status': 'Diterima', 'tarikh': '2026-11-01', 'masa': '17:00',
          'pasukan_home': 'ALFA', 'pasukan_away': 'BRAVO', 'c13_match_id': eligible ? match : null}];
      } else if (options.path.endsWith('announcements.php')) {
        body['announcements'] = [];
      }
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: body));
    });
    Api.instance.dio.interceptors.add(interceptor);
  });
  tearDown(() {
    Api.instance.dio.interceptors.remove(interceptor);
    Api.instance.user.value = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('plugins.flutter.io/url_launcher'), null);
  });

  Future<void> dashboard(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: UtamaScreen(
      onOpenTab: (_, {refresh = false}) {}, onOpenNotifications: () {}, onOpenEntry: (_) async {}, unread: 0)));
    await tester.pumpAndSettle();
  }

  testWidgets('dashboard exposes the appointed C13 and opens its authenticated browser link', (tester) async {
    await dashboard(tester);
    expect(find.text('C13 · Laporan pengadil'), findsOneWidget);
    expect(find.text('03 · ALFA lwn BRAVO'), findsOneWidget);
    await tester.ensureVisible(find.text('Isi C13'));
    await tester.tap(find.text('Isi C13'));await tester.pumpAndSettle();
    expect(launches, 1);expect(opened, contains('view=open&ticket=EXAMPLE'));
    expect(tester.takeException(), isNull);
  });
  testWidgets('received C13 has a view action', (tester) async {
    submitted = true;await dashboard(tester);
    expect(find.text('Lihat C13'), findsOneWidget);expect(find.text('Isi C13'), findsNothing);
  });
  testWidgets('unappointed official gets no C13 action', (tester) async {
    eligible = false;await dashboard(tester);
    expect(find.byType(C13Button), findsNothing);
  });
  testWidgets('C13 also appears on the accepted task', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const Scaffold(body: TugasanScreen())));
    await tester.pumpAndSettle();
    // Past accepted appointments remain accessible from Semua.
    await tester.tap(find.text('Semua').first);await tester.pumpAndSettle();
    expect(find.byType(C13Button), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

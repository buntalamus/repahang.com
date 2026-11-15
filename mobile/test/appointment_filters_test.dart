import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/screens/lantikan_admin_screen.dart';
import 'package:refpahang/theme.dart';

void main() {
  late List<RequestOptions> requests;

  setUp(() {
    requests = [];
    Api.instance.user.value = SessionUser({'id': 1, 'role': 'Admin'});
    final interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(options);
      final data = switch (options.path) {
        '/api/kejohanan.php' => [
          {'id': 1, 'nama': 'Piala Admin', 'status': 'Aktif', 'jumlah_perlawanan': 100},
          {'id': 2, 'nama': 'Piala Kuantan', 'status': 'Aktif', 'lantikan_persatuan_id': 3,
            'lantikan_daerah_nama': 'PB Daerah Kuantan'},
          {'id': 3, 'nama': 'Piala PP Selesai', 'status': 'Selesai', 'lantikan_persatuan_id': 3},
        ],
        '/api/jadual-perlawanan.php' => List.generate(100, (i) => {
          'id': i + 1, 'no_perlawanan': 'B18-${i + 1}', 'tarikh': '2026-11-${16 + i ~/ 20}',
          'pasukan_home': 'Pasukan ${i + 1}', 'pasukan_away': 'Lawan', 'masa': '17:00',
          'tempat': i.isOdd ? 'Padang A' : 'Padang B', 'jumlah_lantikan': 3, 'jumlah_terima': 2,
        }),
        _ => [],
      };
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: {'error': false, 'data': data}));
    });
    Api.instance.dio.interceptors.add(interceptor);
    addTearDown(() {
      Api.instance.dio.interceptors.remove(interceptor);
      Api.instance.user.value = null;
    });
  });

  Future<void> open(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const Scaffold(body: LantikanAdminScreen())));
    await tester.pumpAndSettle();
  }

  testWidgets('Admin switches ownership independently of active status; PP has no cross-owner controls', (tester) async {
    await open(tester);
    expect(find.text('Piala Admin'), findsOneWidget);
    expect(find.text('Piala Kuantan'), findsNothing);
    await tester.tap(find.text('Lantikan PP Daerah'));
    await tester.pumpAndSettle();
    expect(find.text('Piala Admin'), findsNothing);
    expect(find.text('Piala Kuantan'), findsOneWidget);
    expect(find.text('PB Daerah Kuantan'), findsOneWidget);
    expect(find.text('Piala PP Selesai'), findsNothing);
    await tester.tap(find.text('Semua'));
    await tester.pumpAndSettle();
    expect(find.text('Piala PP Selesai'), findsOneWidget);
    await tester.tap(find.text('Semua Lantikan'));
    await tester.pumpAndSettle();
    expect(find.text('Piala Admin'), findsOneWidget);
    expect(find.text('Piala Kuantan'), findsOneWidget);
    Api.instance.user.value = SessionUser({'id': 2, 'role': 'PP Daerah'});
    await tester.pumpWidget(const SizedBox());
    await open(tester);
    expect(find.text('Lantikan Admin'), findsNothing);
    expect(find.text('Lantikan PP Daerah'), findsNothing);
  });

  testWidgets('100 games filter by day and exact number, preserve selection after appointment, and handle no results', (tester) async {
    await open(tester);
    await tester.tap(find.text('Piala Admin'));
    await tester.pumpAndSettle();
    expect(find.text('100 daripada 100 perlawanan'), findsOneWidget);
    await tester.tap(find.text('Seterusnya ›'));
    await tester.pumpAndSettle();
    expect(find.text('20 daripada 100 perlawanan'), findsOneWidget);
    await tester.tap(find.text('Seterusnya ›'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '25');
    await tester.pumpAndSettle();
    expect(find.text('1 daripada 100 perlawanan'), findsOneWidget);
    await tester.tap(find.text('Pasukan 25 vs Lawan'));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('1 daripada 100 perlawanan'), findsOneWidget);
    expect(find.text('25'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '5');
    await tester.pumpAndSettle();
    expect(find.text('Tiada perlawanan sepadan'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Padang A');
    await tester.pumpAndSettle();
    expect(find.text('10 daripada 100 perlawanan'), findsOneWidget);
    await tester.tap(find.text('‹ Sebelum'));
    await tester.pumpAndSettle();
    expect(find.text('10 daripada 100 perlawanan'), findsOneWidget);
    expect(requests.where((r) => r.method != 'GET'), isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('day controls remain usable on a small phone with larger text', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.3)), child: child!),
      home: const Scaffold(body: LantikanAdminScreen())));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Piala Admin'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Seterusnya ›'));
    await tester.pumpAndSettle();
    expect(find.text('20 daripada 100 perlawanan'), findsOneWidget);
    expect(tester.takeException(), isNull);
    tester.view.viewInsets = const FakeViewPadding(bottom: 260);
    addTearDown(tester.view.resetViewInsets);
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}

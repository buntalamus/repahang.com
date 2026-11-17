import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/navigation.dart';
import 'package:refpahang/screens/rekod_negeri_asal_screen.dart';
import 'package:refpahang/theme.dart';

void main() {
  late Map<String, dynamic> row;
  late List<RequestOptions> writes;
  final records = [
    {
      'id': 5,
      'tarikh': '2026-01-01',
      'masa': '16:30',
      'home_team': 'ALFA',
      'away_team': 'BRAVO',
      'nama_kejohanan': 'Liga Selangor',
      'jenis': 'Liga',
      'tempat': 'Padang Asal',
      'jawatan': 'Pengadil',
    },
  ];
  setUp(() {
    row = {
      'id': 1,
      'user_id': 80,
      'referee_name': 'PENGADIL UJIAN',
      'origin_state': 'Selangor',
      'transfer_date': '2026-09-01',
      'date_from': '2026-01-01',
      'date_to': '2026-08-31',
      'status': 'requested',
      'revision': 2,
      'verifier_name': 'PP Negeri Asal',
      'expires_on': '2099-12-31',
      'proof_name': 'buku-log.pdf',
      'record_count': 1,
    };
    writes = [];
    final interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        Map<String, dynamic> body;
        if (options.method == 'POST') {
          writes.add(options);
          final payload = options.data as Map<String, dynamic>;
          row['status'] = switch (payload['action']) {
            'grant' => 'open',
            'accept' => 'accepted',
            'submit' => 'submitted',
            'revoke' => 'revoked',
            _ => row['status'],
          };
          row['revision'] = (row['revision'] as int) + 1;
          row['review_notes'] = payload['notes'];
          body = {'error': false, 'message': 'Keputusan disimpan.'};
        } else if (options.queryParameters.containsKey('id')) {
          body = {
            'error': false,
            'request': {...row, 'access_active': row['status'] == 'open'},
            'records': records,
          };
        } else {
          body = {
            'error': false,
            'requests': [row],
            'states': ['Selangor', 'Johor'],
            'today': '2026-11-16',
            'pagination': {'page': 1, 'total_pages': 1},
          };
        }
        handler.resolve(
          Response(requestOptions: options, statusCode: 200, data: body),
        );
      },
    );
    Api.instance.dio.interceptors.add(interceptor);
    addTearDown(() {
      Api.instance.dio.interceptors.remove(interceptor);
      Api.instance.user.value = null;
    });
  });
  Future<void> open(WidgetTester tester, {bool admin = false}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Api.instance.user.value = SessionUser({
      'id': admin ? 1 : 80,
      'role': admin ? 'Admin' : 'Pengadil',
      'can_referee': admin ? 0 : 1,
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(),
        home: RekodNegeriAsalScreen(admin: admin),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.text(admin ? 'PENGADIL UJIAN · Selangor' : 'Selangor').first,
    );
    await tester.pumpAndSettle();
  }

  Future<void> reveal(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(
      finder,
      280,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Admin opens scoped access and submits the expected revision', (
    tester,
  ) async {
    await open(tester, admin: true);
    await reveal(tester, find.text('Buka akses khas'));
    expect(find.text('Kawalan Admin'), findsOneWidget);
    await tester.tap(find.text('Buka akses khas'));
    await tester.pumpAndSettle();
    final request = writes.single.data as Map;
    expect(request['action'], 'grant');
    expect(request['id'], 1);
    expect(request['revision'], 2);
    expect(request['date_from'], '2026-01-01');
    expect(request['date_to'], '2026-08-31');
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Admin must enter review notes before accepting; acceptance locks controls',
    (tester) async {
      row['status'] = 'submitted';
      await open(tester, admin: true);
      final accept = find.text('Terima semua rekod selepas semakan bukti');
      await reveal(tester, accept);
      await tester.tap(accept);
      await tester.pumpAndSettle();
      expect(writes, isEmpty);
      final notes = find.widgetWithText(
        TextFormField,
        'Catatan semakan / sebab keputusan',
      );
      await tester.enterText(notes, 'Buku log dan PP negeri asal disemak.');
      await tester.tap(accept);
      await tester.pumpAndSettle();
      expect((writes.single.data as Map)['action'], 'accept');
      expect((writes.single.data as Map)['revision'], 2);
      expect(find.text('Kawalan Admin'), findsNothing);
      expect(
        find.textContaining('Disahkan PP negeri asal · Diterima Admin Pahang'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Pengadil submits own list without Admin review controls', (
    tester,
  ) async {
    row['status'] = 'open';
    await open(tester);
    expect(find.text('Kawalan Admin'), findsNothing);
    expect(find.text('Terima semua rekod selepas semakan bukti'), findsNothing);
    final submit = find.text('Hantar 1 rekod kepada Admin');
    await reveal(tester, submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect((writes.single.data as Map)['action'], 'submit');
    expect(find.text('Tambah rekod perlawanan'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Historical date picker allows old dates within the grant on a small screen',
    (tester) async {
      row['status'] = 'open';
      await open(tester);
      await reveal(tester, find.text('Tambah rekod perlawanan'));
      await tester.tap(find.text('Tambah rekod perlawanan'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(TextFormField, 'Tarikh perlawanan *'),
      );
      await tester.pumpAndSettle();
      final picker = tester.widget<CalendarDatePicker>(
        find.byType(CalendarDatePicker),
      );
      expect(picker.firstDate, DateTime(2026, 1, 1));
      expect(picker.lastDate, DateTime(2026, 8, 31));
      expect(tester.takeException(), isNull);
    },
  );

  test('Menu keeps Admin review and PP personal history distinct', () {
    final admin =
        menuFor(SessionUser({'id': 1, 'role': 'Admin'}))
                .expand((s) => s.entries)
                .firstWhere((e) => e.label == 'Rekod Negeri Asal')
                .screen!()
            as RekodNegeriAsalScreen;
    expect(admin.admin, isTrue);
    final pp =
        menuFor(SessionUser({'id': 2, 'role': 'PP Daerah', 'can_referee': 1}))
                .expand((s) => s.entries)
                .firstWhere((e) => e.label == 'Rekod Negeri Asal Saya')
                .screen!()
            as RekodNegeriAsalScreen;
    expect(pp.admin, isFalse);
    expect(
      menuFor(SessionUser({'id': 2, 'role': 'PP Daerah', 'can_referee': 0}))
          .expand((s) => s.entries)
          .where((e) => e.label.contains('Negeri Asal')),
      isEmpty,
    );
  });
}

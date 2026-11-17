import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/screens/admin_laporan_screen.dart';
import 'package:refpahang/screens/laporan_ra_screen.dart';
import 'package:refpahang/screens/laporan_view.dart';
import 'package:refpahang/theme.dart';

final _report = {
  'id': 104,
  'status': 'Dihantar',
  'tarikh': '2026-11-01',
  'no_perlawanan': 'LJ-07',
  'nama_kejohanan': 'Liga Jerantut',
  'pasukan_home': 'JERANTUT',
  'pasukan_away': 'LIPIS',
  'nama_penilai': 'RAMAN',
  'tahap_kesukaran': 'Sederhana',
  'skor_ht_home': 1, 'skor_ht_away': 0, 'skor_ft_home': 2, 'skor_ft_away': 1,
  'pegawai': [
    {'jawatan': 'Pengadil', 'nama_pengadil': 'ISMAIL', 'markah': '8.3', 'prestasi': 'Baik',
      'kawalan_kekuatan': ['Posisi baik'], 'kawalan_kelemahan': [], 'kawalan_nasihat': 'Teruskan'},
    {'jawatan': 'Penolong Pengadil 1', 'nama_pengadil': 'AR SATU', 'markah': '8.2', 'prestasi': 'Baik',
      'kawalan_kekuatan': ['Ofsaid'], 'kawalan_kelemahan': [], 'kawalan_nasihat': ''},
  ],
  'pengesahan': {'pengesahan_status': 'Menunggu', 'pengesah_nama': 'PENGERUSI', 'email_applicable': 1,
    'email_sent_at': '2026-11-01 12:00:00', 'telegram_applicable': 0},
};

void main() {
  late List<RequestOptions> requests;

  setUp(() => requests = []);

  void stub(WidgetTester tester, Object? Function(RequestOptions) reply) {
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(options);
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: reply(options)));
    });
    Api.instance.dio.interceptors.add(interceptor);
    addTearDown(() => Api.instance.dio.interceptors.remove(interceptor));
  }

  test('final score adds both halves and extra time, with penalties in brackets', () {
    expect(finalScore(_report), '3 - 1');
    expect(finalScore({..._report, 'skor_et_home': 1, 'skor_ps_home': 4, 'skor_ps_away': 3}), '4 (4) - 1 (3)');
    expect(finalScore({'skor_ht_home': 1, 'skor_ht_away': 0}), isNull);
  });

  testWidgets('Admin sees the waiting report, its criteria and overrides it with a reason', (tester) async {
    stub(tester, (o) => o.method == 'PUT'
        ? {'error': false, 'message': 'Override Admin direkodkan.'}
        : o.queryParameters.containsKey('id')
            ? {'error': false, 'laporan': _report}
            : {'error': false, 'data': [_report]});
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminLaporanScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Menunggu Pengerusi'), findsOneWidget);
    expect(find.text('AR1: 8.2'), findsOneWidget);
    await tester.tap(find.text('JERANTUT vs LIPIS'));
    await tester.pumpAndSettle();

    expect(find.text('3 - 1'), findsOneWidget);
    expect(find.text('• Ofsaid'), findsOneWidget);
    expect(find.text('Emel dihantar'), findsOneWidget);
    // A Dihantar report has no printable copy yet.
    expect(find.text('Lihat PDF'), findsNothing);

    await tester.tap(find.text('Override & Sahkan Laporan'));
    await tester.pumpAndSettle();
    expect(requests.where((r) => r.method == 'PUT'), isEmpty, reason: 'the reason is required');

    await tester.enterText(find.byType(TextField).first, 'Pengerusi bercuti');
    await tester.tap(find.text('Override & Sahkan Laporan'));
    await tester.pumpAndSettle();
    final put = requests.singleWhere((r) => r.method == 'PUT');
    expect(put.data, {'action': 'sahkan', 'override_reason': 'Pengerusi bercuti', 'catatan_admin': '', 'id': 104});
    expect(find.text('Override & Sahkan Laporan'), findsNothing, reason: 'the sheet closes');
  });

  testWidgets('Admin outstanding tab lists RA duties without a report', (tester) async {
    stub(tester, (o) => {'error': false, 'data': o.queryParameters.containsKey('tertunggak')
        ? [{'lantikan_id': 9, 'tarikh': '2026-10-30', 'pasukan_home': 'A', 'pasukan_away': 'B', 'nama_penilai': 'RA',
            'status': 'Belum diisi', 'ra_form_url': null, 'no_telefon': '0123'}]
        : []});
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminLaporanScreen()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Belum dihantar RA'));
    await tester.pumpAndSettle();
    expect(find.text('Belum diisi'), findsOneWidget);
    await tester.tap(find.text('Sediakan pautan'));
    await tester.pumpAndSettle();
    expect(requests.singleWhere((r) => r.method == 'POST').data, {'action': 'prepare_links', 'lantikan_id': 9});
  });

  testWidgets('Assessor can open a sent report and gets PDF only once it is approved', (tester) async {
    stub(tester, (o) => switch (o.path) {
          '/api/tugasan.php' => {'error': false, 'data': [
              {'id': 1, 'status': 'Diterima', 'jawatan': 'Penilai Pengadil', 'tarikh': '2026-11-01',
                'pasukan_home': 'JERANTUT', 'pasukan_away': 'LIPIS'},
              {'id': 2, 'status': 'Diterima', 'jawatan': 'Penilai Pengadil', 'tarikh': '2026-10-01',
                'pasukan_home': 'BERA', 'pasukan_away': 'ROMPIN'},
            ]},
          _ when o.queryParameters.containsKey('id') => {'error': false, 'laporan': _report},
          _ => {'error': false, 'data': [
              {'id': 104, 'lantikan_id': 1, 'status': 'Dihantar'},
              {'id': 90, 'lantikan_id': 2, 'status': 'Disahkan'},
            ]},
        });
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const Scaffold(body: LaporanRaScreen())));
    await tester.pumpAndSettle();

    expect(find.text('Lihat laporan'), findsNWidgets(2));
    expect(find.text('PDF'), findsOneWidget);
    await tester.tap(find.text('Lihat laporan').first);
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters, {'id': 104});
    expect(find.text('• Posisi baik'), findsOneWidget);
  });
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/screens/laporan_form_screen.dart';
import 'package:refpahang/theme.dart';

void main() {
  testWidgets('AR and 4th official criteria and the match score reach the draft body', (tester) async {
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Map<String, dynamic>? posted;
    final interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      if (options.method == 'POST') posted = Map<String, dynamic>.from(options.data as Map);
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: options.method == 'POST'
          ? {'error': false, 'id': 104, 'message': 'Draf laporan disimpan.'}
          : {
              'error': false,
              'data': [
                {'lantikan_id': 21, 'jawatan': 'Pengadil', 'nama_pengadil': 'PENGADIL', 'sections': [
                  {'key': 'kawalan', 'label': 'Kawalan Permainan', 'items': ['Mengenalpasti kesalahan']},
                  {'key': 'fizikal', 'label': 'Fizikal', 'items': ['Posisi']},
                ]},
                {'lantikan_id': 22, 'jawatan': 'Penolong Pengadil 1', 'nama_pengadil': 'AR SATU', 'sections': [
                  {'key': 'penolong', 'label': 'Penolong Pengadil', 'items': ['Ofsaid', 'Lontaran']},
                ]},
                {'lantikan_id': 23, 'jawatan': 'Pegawai ke4', 'nama_pengadil': 'P EMPAT', 'sections': [
                  {'key': 'keempat', 'label': 'Pegawai Keempat', 'items': ['Kawasan teknikal']},
                ]},
              ],
            }));
    });
    Api.instance.dio.interceptors.add(interceptor);
    addTearDown(() => Api.instance.dio.interceptors.remove(interceptor));

    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(),
      home: const LaporanFormScreen(
        assignment: {'id': 1551, 'jadual_id': 1220, 'pasukan_home': 'JERANTUT', 'pasukan_away': 'LIPIS', 'tarikh': '2026-11-01'},
        report: {
          'id': 104,
          'skor_ht_home': 1,
          'skor_ht_away': 0,
          'pegawai': [
            {'lantikan_pengadil_id': 22, 'markah': '8.3', 'kawalan_kekuatan': ['Ofsaid'], 'kawalan_nasihat': 'Bendera lurus'},
          ],
        },
      ),
    ));
    await tester.pumpAndSettle();

    // The saved AR criteria reopen under the `penolong` section.
    await tester.tap(find.text('AR1 ✓'));
    await tester.pumpAndSettle();
    expect(find.text('• Ofsaid'), findsOneWidget);
    expect(find.text('Bendera lurus'), findsOneWidget);

    // Pick a 4th official criterion and enter the full-time score.
    await tester.tap(find.text('4th'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kekuatan'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kawasan teknikal'));
    await tester.tap(find.text('Siap'));
    await tester.pumpAndSettle();
    final scores = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == '-');
    await tester.enterText(scores.at(2), '2');
    await tester.enterText(scores.at(3), '1');

    await tester.tap(find.text('Simpan draf'));
    await tester.pumpAndSettle();

    final pegawai = [for (final p in posted!['pegawai'] as List) Map<String, dynamic>.from(p as Map)];
    expect(pegawai[1]['kawalan_kekuatan'], ['Ofsaid']);
    expect(pegawai[1]['kawalan_nasihat'], 'Bendera lurus');
    expect(pegawai[2]['kawalan_kekuatan'], ['Kawasan teknikal']);
    expect(pegawai[2]['fizikal_kekuatan'], isEmpty);
    expect([posted!['skor_ht_home'], posted!['skor_ht_away'], posted!['skor_ft_home'], posted!['skor_ft_away']], [1, 0, 2, 1]);
    expect(posted!['skor_et_home'], isNull);
  });
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/screens/login_screen.dart';
import 'package:refpahang/theme.dart';

void main() {
  testWidgets('inactive account shows the server reason without creating a session', (tester) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      if (options.path.endsWith('mobile-login.php')) {
        handler.resolve(Response(requestOptions: options, statusCode: 403, data: {
          'error': true,
          'code': 'ACCOUNT_INACTIVE',
          'message': 'Akaun anda ditandakan Tidak Aktif. Anda tidak boleh log masuk.',
          'reason': 'Tiada aktiviti atau log masuk sepanjang 8 bulan terakhir.',
        }));
      } else {
        handler.resolve(Response(requestOptions: options, statusCode: 200, data: {'error': false, 'data': []}));
      }
    });
    Api.instance.dio.interceptors.add(interceptor);
    addTearDown(() => Api.instance.dio.interceptors.remove(interceptor));
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const LoginScreen()));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'inactive@example.invalid');
    await tester.enterText(find.byType(TextField).at(1), 'fixture-password');
    await tester.tap(find.widgetWithText(FilledButton, 'Log masuk'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.text('Akaun Tidak Aktif'), findsOneWidget);
    expect(find.text('Tiada aktiviti atau log masuk sepanjang 8 bulan terakhir.'), findsOneWidget);
    expect(Api.instance.user.value, isNull);
    expect(Api.instance.token, isNull);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Tutup'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Log masuk'), findsOneWidget);
  });
}

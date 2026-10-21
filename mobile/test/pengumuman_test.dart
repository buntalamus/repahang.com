import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/push.dart';
import 'package:refpahang/screens/home_shell.dart';
import 'package:refpahang/screens/pengumuman_screen.dart';
import 'package:refpahang/screens/utama_screen.dart';
import 'package:refpahang/theme.dart';

void main() {
  late Interceptor interceptor;
  var read = false;
  var marks = 0;
  var failRead = false;
  var missing = false;
  Object? requestedId;
  final items = List.generate(4, (i) => <String, dynamic>{
    'id': i + 1, 'title': 'Pengumuman ${i + 1}',
    'content': 'Maklumat penting untuk semua pegawai.\nSila semak jadual dan arahan penuh sebelum bertugas.',
    'created_at': '2026-10-21 15:00:00', 'is_read': 0,
  });
  setUp(() {
    read = false; marks = 0; failRead = false; missing = false; requestedId = null;
    interceptor = InterceptorsWrapper(onRequest: (options, handler) {
      var status = 200;
      Map<String, dynamic> body = {'error': false};
      if (options.path.endsWith('/announcements.php')) {
        if (options.queryParameters['id'] != null) {
          requestedId = options.queryParameters['id'];
          if (missing) { status = 404; body = {'error': true, 'message': 'Pengumuman tidak ditemui.'}; }
          else { body['announcement'] = {...items.first, 'is_read': read ? 1 : 0}; }
        } else {
          body['announcements'] = [ {...items.first, 'is_read': read ? 1 : 0}, ...items.skip(1) ];
        }
      } else if (options.path.endsWith('/announcement-read.php')) {
        marks++;
        if (failRead) { status = 500; body = {'error': true, 'message': 'Gagal'}; }
        else { read = true; }
      }
      handler.resolve(Response(requestOptions: options, statusCode: status, data: body));
    });
    Api.instance.dio.interceptors.add(interceptor);
  });
  tearDown(() {
    Api.instance.dio.interceptors.remove(interceptor);
    Api.instance.user.value = null;
    PushService.instance.openScreen.value = null;
  });

  testWidgets('push opens the exact announcement from the app shell', (tester) async {
    Api.instance.user.value = SessionUser({'id': 1, 'role': 'Pengadil', 'nama_penuh': 'Pegawai Ujian'});
    PushService.instance.openScreen.value = 'pengumuman:42';
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const HomeShell()));
    await tester.pumpAndSettle();
    expect(find.byType(AnnouncementDetailScreen), findsOneWidget);
    expect(requestedId, 42);
    expect(marks, 1);
    expect(PushService.instance.openScreen.value, isNull);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('list opens full content and clears only the read badge after opening', (tester) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const PengumumanScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Baharu'), findsNWidgets(4));
    expect(marks, 0);
    await tester.tap(find.text('Pengumuman 1'));
    await tester.pumpAndSettle();
    expect(find.byType(SelectableText), findsOneWidget);
    expect(marks, 1);
    expect(read, isTrue);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Baharu'), findsNWidgets(3));
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed read status can retry and deleted announcement is not marked', (tester) async {
    failRead = true;
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AnnouncementDetailScreen(id: 1)));
    await tester.pumpAndSettle();
    expect(find.text('Status bacaan belum disimpan. Cuba lagi'), findsOneWidget);
    failRead = false;
    await tester.tap(find.text('Status bacaan belum disimpan. Cuba lagi'));
    await tester.pumpAndSettle();
    expect(read, isTrue);
    expect(marks, 2);
    missing = true;
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AnnouncementDetailScreen(key: ValueKey('deleted'), id: 999)));
    await tester.pumpAndSettle();
    expect(find.text('Pengumuman tidak ditemui.'), findsOneWidget);
    expect(marks, 2);
  });

  for (final role in ['Admin', 'PP Daerah', 'Penilai', 'Pengadil']) {
    testWidgets('$role home shows three announcements with access to all', (tester) async {
      Api.instance.user.value = SessionUser({'id': 1, 'role': role, 'nama_penuh': 'Pegawai Ujian'});
      await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: Scaffold(body: UtamaScreen(
        onOpenTab: (id, {refresh = false}) {}, onOpenNotifications: () {}, unread: 0,
      ))));
      await tester.pumpAndSettle();
      expect(find.text('Pengumuman 1'), findsOneWidget);
      expect(find.text('Pengumuman 3'), findsOneWidget);
      expect(find.text('Pengumuman 4'), findsNothing);
      await tester.tap(find.text('Lihat semua').first);
      await tester.pumpAndSettle();
      expect(find.byType(PengumumanScreen), findsOneWidget);
      expect(find.text('Pengumuman 4'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}

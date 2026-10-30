import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/release_notes.dart';
import 'package:refpahang/theme.dart';
import 'package:refpahang/widgets/common.dart';
import 'package:refpahang/widgets/update_notes.dart';

MobileReleaseNote note(int patch, {String release = '1.3.0+7', List<String>? changes}) => MobileReleaseNote({
  'release_version': release, 'patch': patch, 'date': '2026-10-21',
  'changes': changes ?? ['Perubahan untuk patch $patch'],
});

void main() {
  test('shows only uninstalled changes through the exact downloaded patch and build', () {
    final notes = [note(3), note(4), note(5), note(6), note(5, release: '1.3.0+8')];
    expect(selectPatchNotes(notes, releaseVersion: '1.3.0+7', currentPatch: 3, nextPatch: 5)
        .map((n) => n.patch), [5, 4]);
    expect(selectPatchNotes(notes, releaseVersion: '1.3.0+7', currentPatch: 4, nextPatch: 5)
        .map((n) => n.patch), [5]);
    expect(selectPatchNotes(notes, releaseVersion: '1.3.0+7', currentPatch: 5, nextPatch: 5), isEmpty);
    expect(selectPatchNotes(notes, releaseVersion: '1.3.0+7', currentPatch: 5, nextPatch: 4), isEmpty);
    expect(selectPatchNotes(notes, releaseVersion: '1.3.0+7', currentPatch: 3, nextPatch: 9), isEmpty);
    expect(selectPatchNotes(notes, releaseVersion: '2.0.0+10', currentPatch: 0, nextPatch: 5), isEmpty);
  });

  test('APK prompt uses only the target native release notes', () {
    final notes = [note(0, release: '1.4.0+8'), note(1, release: '1.4.0+8'), note(0)];
    expect(selectNativeNotes(notes, '1.4.0').single.releaseVersion, '1.4.0+8');
    expect(selectNativeNotes(notes, '2.0.0'), isEmpty);
    expect(releaseNotesFrom({}), isEmpty);
  });

  testWidgets('existing popup shows version, date and changes and preserves restart and cancel', (tester) async {
    bool? accepted;
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: Builder(builder: (context) => Scaffold(
      body: TextButton(onPressed: () async {
        accepted = await confirmSheet(context, title: 'Kemas kini sedia', message: 'Mula semula app.',
            confirmLabel: 'Mula semula', details: UpdateNotes(load: () async => [note(5)]));
      }, child: const Text('Buka')),
    ))));
    await tester.tap(find.text('Buka'));
    await tester.pumpAndSettle();
    expect(find.text('Apa yang baharu'), findsOneWidget);
    expect(find.textContaining('1.3.0+7 • Patch 5'), findsOneWidget);
    expect(find.textContaining('21 Okt 2026'), findsOneWidget);
    expect(find.text('Perubahan untuk patch 5'), findsOneWidget);
    await tester.tap(find.text('Batal'));
    await tester.pumpAndSettle();
    expect(accepted, isFalse);
    await tester.tap(find.text('Buka'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mula semula'));
    await tester.pumpAndSettle();
    expect(accepted, isTrue);
  });

  testWidgets('offline notes can retry without blocking the restart button', (tester) async {
    var offline = true;
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: Scaffold(body: Column(children: [
      UpdateNotes(load: () async {
        if (offline) throw Exception('offline');
        return [note(5)];
      }),
      FilledButton(onPressed: () {}, child: const Text('Mula semula')),
    ]))));
    await tester.pumpAndSettle();
    expect(find.text('Catatan perubahan tidak dapat dimuatkan.'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNotNull);
    offline = false;
    await tester.tap(find.text('Cuba lagi'));
    await tester.pumpAndSettle();
    expect(find.text('Perubahan untuk patch 5'), findsOneWidget);
  });

  testWidgets('long changelog scrolls on a small phone with large text', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.5)), child: child!),
      home: Builder(builder: (context) => Scaffold(body: TextButton(onPressed: () {
        confirmSheet(context, title: 'Kemas kini sedia', message: 'Mula semula app.', confirmLabel: 'Mula semula',
            details: UpdateNotes(load: () async => [note(5, changes: List.filled(12,
              'Anda boleh membaca pengumuman penuh dan melihat penanda Baharu mengikut status bacaan.'))]));
      }, child: const Text('Buka')))),
    ));
    await tester.tap(find.text('Buka'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Mula semula'), 400, maxScrolls: 20);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Mula semula'));
    await tester.pumpAndSettle();
    expect(find.text('Kemas kini sedia'), findsNothing);
  });
}

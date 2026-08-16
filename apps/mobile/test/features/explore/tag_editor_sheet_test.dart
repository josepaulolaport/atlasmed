import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/tag_editor_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The multiselect behind "Editar" on a clinic's focos clínicos and a doctor's
/// especialidades.
///
/// Neither could be set from the app at all before this: both join tables had
/// the CNES importer as their only writer. The sheet's job is to collect a whole
/// selection with at most one primary, and — the part worth pinning — to hold on
/// to that selection when the save fails.
const _copy = TagEditorCopy(
  title: 'Focos clínicos',
  searchHint: 'Buscar foco clínico…',
  notFound: 'Nenhum foco clínico encontrado.',
  primaryHint: 'Toque na estrela para definir o foco principal',
);

const _options = [
  TagOption(id: 1, label: 'Ortopedia'),
  TagOption(id: 2, label: 'Cardiologia'),
  TagOption(id: 3, label: 'Neurologia'),
];

Future<TagEditorResult?> pump(
  WidgetTester tester, {
  Set<int> selected = const {},
  int? primaryId,
  required Future<void> Function(TagEditorResult) onSave,
}) async {
  // The default 800×600 test viewport clips a sheet sized to 78% of the screen,
  // putting the save button off-screen.
  tester.view.physicalSize = const Size(420, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  TagEditorResult? result;
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await TagEditorSheet.show(
                context,
                copy: _copy,
                options: _options,
                selectedIds: selected,
                primaryId: primaryId,
                onSave: onSave,
              );
            },
            child: const Text('abrir'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
  return result;
}

void main() {
  testWidgets('gives back the whole selection and the starred entry', (
    tester,
  ) async {
    TagEditorResult? saved;
    await pump(tester, onSave: (result) async => saved = result);

    await tester.tap(find.byKey(const Key('tag-option-1')));
    await tester.tap(find.byKey(const Key('tag-option-3')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-primary-3')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pumpAndSettle();

    expect(saved?.selectedIds, {1, 3});
    expect(saved?.primaryId, 3);
  });

  testWidgets('starring an unticked entry selects it too', (tester) async {
    // Otherwise the star is a control that appears to do nothing until the row
    // has been ticked first, which nothing on screen says.
    TagEditorResult? saved;
    await pump(tester, onSave: (result) async => saved = result);

    await tester.tap(find.byKey(const Key('tag-primary-2')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pumpAndSettle();

    expect(saved?.selectedIds, {2});
    expect(saved?.primaryId, 2);
  });

  testWidgets('unticking the primary clears it rather than sending it', (
    tester,
  ) async {
    // A primary the record no longer holds is rejected by the server, and the
    // rejection would be about a row the user had just removed.
    TagEditorResult? saved;
    await pump(
      tester,
      selected: {1, 2},
      primaryId: 1,
      onSave: (result) async => saved = result,
    );

    await tester.tap(find.byKey(const Key('tag-option-1')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pumpAndSettle();

    expect(saved?.selectedIds, {2});
    expect(saved?.primaryId, isNull);
  });

  testWidgets('a failed save keeps the sheet open with the selection intact', (
    tester,
  ) async {
    // Twelve focuses picked over a dropped request is the whole reason this is
    // not a fire-and-close.
    await pump(tester, onSave: (_) async => throw Exception('sem conexão'));

    await tester.tap(find.byKey(const Key('tag-option-1')));
    await tester.tap(find.byKey(const Key('tag-option-2')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('tag-editor-save')), findsOneWidget);
    expect(find.textContaining('sem conexão'), findsOneWidget);
    expect(
      tester
          .widget<Checkbox>(
            find.descendant(
              of: find.byKey(const Key('tag-option-1')),
              matching: find.byType(Checkbox),
            ),
          )
          .value,
      isTrue,
    );
  });

  testWidgets('search ignores case and accents', (tester) async {
    await pump(tester, onSave: (_) async {});

    await tester.enterText(
      find.byKey(const Key('tag-editor-search')),
      'cardiologia',
    );
    await tester.pump();

    expect(find.text('Cardiologia'), findsOneWidget);
    expect(find.text('Ortopedia'), findsNothing);
  });

  testWidgets('says so when the search matches nothing', (tester) async {
    await pump(tester, onSave: (_) async {});

    await tester.enterText(
      find.byKey(const Key('tag-editor-search')),
      'oftalmologia',
    );
    await tester.pump();

    expect(find.text(_copy.notFound), findsOneWidget);
  });

  testWidgets('Limpar drops the primary along with the selection', (
    tester,
  ) async {
    TagEditorResult? saved;
    await pump(
      tester,
      selected: {1, 2},
      primaryId: 1,
      onSave: (result) async => saved = result,
    );

    await tester.tap(find.text('Limpar'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pumpAndSettle();

    expect(saved?.selectedIds, isEmpty);
    expect(saved?.primaryId, isNull);
  });

  testWidgets('does not fire the save twice on a double tap', (tester) async {
    // The button is disabled while in flight. A second PUT would be harmless on
    // the server — it is a replacement — but the sheet would pop on the first
    // and the second would land against a disposed state.
    var calls = 0;
    final gate = Completer<void>();
    await pump(
      tester,
      onSave: (_) async {
        calls++;
        await gate.future;
      },
    );

    await tester.tap(find.byKey(const Key('tag-option-1')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('tag-editor-save')));
    await tester.pump();
    await tester.tap(
      find.byKey(const Key('tag-editor-save')),
      warnIfMissed: false,
    );
    await tester.pump();

    expect(calls, 1);

    gate.complete();
    await tester.pumpAndSettle();
  });
}

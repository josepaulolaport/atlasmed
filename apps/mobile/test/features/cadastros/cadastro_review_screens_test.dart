import 'dart:async';

import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/providers/cadastro_review_provider.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastro_review_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastros_review_list_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

CadastroReviewSubmission submission({
  int id = 1,
  String facilityName = 'Clinica Seikei',
  EstablishmentDocumentStatus status = EstablishmentDocumentStatus.pending,
}) => CadastroReviewSubmission(
  id: id,
  facilityId: 9,
  facilityName: facilityName,
  documentTitle: 'Alvará de funcionamento',
  documentDescription: 'Documento emitido pela prefeitura.',
  documentFileName: 'alvara.pdf',
  status: status,
  submittedAt: DateTime.utc(2026, 8, 10, 9),
  submittedByName: 'Flavio Ramalho',
);

Future<void> pumpList(
  WidgetTester tester,
  List<CadastroReviewSubmission> queue,
) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        cadastroReviewQueueProvider.overrideWith((ref) async => queue),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const CadastrosReviewListScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('the queue counts itself', () {
    testWidgets('several submissions are "submissões", not "submissãoões"', (
      tester,
    ) async {
      // `'submissão' + 'ões'`, so every count above one was misspelled by
      // concatenation.
      await pumpList(tester, [submission(id: 1), submission(id: 2)]);

      expect(find.text('2 submissões'), findsOneWidget);
      expect(find.textContaining('submissãoões'), findsNothing);
    });

    testWidgets('one submission stays singular', (tester) async {
      await pumpList(tester, [submission()]);

      expect(find.text('1 submissão'), findsOneWidget);
    });

    testWidgets('an empty queue says so once', (tester) async {
      // The header and the body each announced the empty queue, in different
      // words, at the same time.
      await pumpList(tester, const []);

      expect(find.textContaining('neste filtro'), findsNothing);
      expect(find.text('Nada para revisar'), findsOneWidget);
    });
  });

  group('reviewing one submission', () {
    Future<void> pumpDetail(
      WidgetTester tester, {
      required AsyncValue<List<CadastroReviewSubmission>> queue,
    }) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            canReviewCadastroProvider.overrideWithValue(true),
            cadastroReviewQueueProvider.overrideWith((ref) async {
              final value = queue.valueOrNull;
              if (value == null) {
                // Never completes: the screen stays in its loading state.
                return Completer<List<CadastroReviewSubmission>>().future;
              }
              return value;
            }),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const CadastroReviewDetailScreen(submissionId: 1),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('a queue still loading is not a missing submission', (
      tester,
    ) async {
      // "Submissão não encontrada" with a Voltar button showed for the whole
      // of the load, then quietly became the document.
      await pumpDetail(tester, queue: const AsyncValue.loading());

      expect(find.textContaining('não encontrada'), findsNothing);
      expect(find.textContaining('não está na fila'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('an absent submission says which queue it is absent from', (
      tester,
    ) async {
      await pumpDetail(tester, queue: const AsyncValue.data([]));
      await tester.pumpAndSettle();

      expect(find.textContaining('não está na fila'), findsOneWidget);
    });

    testWidgets('rejecting is refused until there is a reason', (tester) async {
      await pumpDetail(tester, queue: AsyncValue.data([submission()]));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('cadastro-decision-reject')));
      // Not pumpAndSettle: the sheet autofocuses, and a blinking cursor is an
      // animation that never settles.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      final button = find.byKey(const Key('cadastro-reject-submit'));
      expect(
        tester.widget<FilledButton>(button).onPressed,
        isNull,
        reason: 'the note is what the rep is told to fix, so it is required',
      );

      await tester.enterText(
        find.byKey(const Key('cadastro-reject-note')),
        'Documento ilegível',
      );
      await tester.pump();

      expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
    });
  });
}

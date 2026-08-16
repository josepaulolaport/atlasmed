import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidade_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidades_list_screen.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

NaoConformidadeSuggestion suggestion({
  int id = 1,
  NaoConformidadeStatus status = NaoConformidadeStatus.pending,
}) => NaoConformidadeSuggestion(
  id: id,
  targetType: NaoConformidadeTargetType.clinic,
  targetId: 9,
  targetName: 'Clinica Seikei',
  fieldLabel: 'Telefone',
  currentValue: '(91) 2361-0555',
  suggestedValue: '(91) 99999-0000',
  submittedByName: 'Flavio Ramalho',
  submittedByRole: NaoConformidadeSubmitterRole.rep,
  submittedAt: DateTime.utc(2026, 8, 10, 9),
  status: status,
);

void phone(WidgetTester tester, {double width = 1170}) {
  tester.view.physicalSize = Size(width, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

Future<void> pumpList(
  WidgetTester tester,
  List<NaoConformidadeSuggestion> queue, {
  double width = 1170,
}) async {
  phone(tester, width: width);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        opsNaoConformidadesProvider.overrideWith((ref, status) async => queue),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const NaoConformidadesListScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('the queue header follows the chips', () {
    testWidgets('an accepted-only view is not counted as pending', (
      tester,
    ) async {
      // The header counted pending whatever the filter, so "Aceitas" with
      // accepted suggestions on screen read "Nenhuma sugestão aguardando
      // análise".
      await pumpList(tester, [
        suggestion(id: 1, status: NaoConformidadeStatus.accepted),
        suggestion(id: 2, status: NaoConformidadeStatus.accepted),
      ]);

      // The header is silent on an empty Pendentes; the body speaks.
      expect(find.text('0 aguardando análise'), findsNothing);

      await tester.tap(find.text('Aceitas'));
      await tester.pumpAndSettle();

      expect(find.text('2 aceitas'), findsOneWidget);
    });

    testWidgets('pending is counted for the pending chip', (tester) async {
      await pumpList(tester, [suggestion()]);

      expect(find.text('1 aguardando análise'), findsOneWidget);
    });

    testWidgets('an empty queue is stated once, and named', (tester) async {
      // The header and the body both announced it, in different words.
      await pumpList(tester, const []);

      expect(find.text('Nenhuma sugestão aguardando análise'), findsNothing);
      expect(find.text('Nada aguardando análise'), findsOneWidget);
      expect(find.text('Nenhuma sugestão neste filtro'), findsNothing);
      // An instruction is not a reason.
      expect(find.text('Puxe para baixo para atualizar'), findsNothing);
    });

    testWidgets('the empty state names which filter is empty', (tester) async {
      // Wider than a phone: "Rejeitadas" is the third of four chips and sits
      // half off a 390pt viewport, where a tap does not hit it.
      await pumpList(tester, [suggestion()], width: 1600);

      await tester.tap(find.text('Rejeitadas'));
      await tester.pumpAndSettle();

      expect(find.text('Nenhuma sugestão rejeitada'), findsOneWidget);
    });
  });

  group('deciding one suggestion', () {
    testWidgets('rejecting is refused until there is a reason', (tester) async {
      // The button popped `''` on an empty field and the caller discarded it,
      // so the dialog closed exactly as if the rejection had been recorded.
      phone(tester);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            canReviewFieldSuggestionsProvider.overrideWithValue(true),
            // Otherwise this builds a real repository, whose 8-minute
            // refresh timer is still pending when the tree is torn down.
            currentUserProvider.overrideWith((ref) async => null),
            naoConformidadeByIdProvider.overrideWith(
              (ref, id) async => suggestion(),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const NaoConformidadeDetailScreen(suggestionId: 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('nc-decision-reject')));
      // Not pumpAndSettle: the dialog autofocuses, and a blinking cursor never
      // settles.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      final button = find.byKey(const Key('nc-reject-submit'));
      expect(
        tester.widget<FilledButton>(button).onPressed,
        isNull,
        reason: 'a rejection with no reason tells the sender nothing',
      );

      await tester.enterText(
        find.byKey(const Key('nc-reject-note')),
        'Telefone confere com o cadastro atual',
      );
      await tester.pump();

      expect(tester.widget<FilledButton>(button).onPressed, isNotNull);

      // Close the dialog: leaving it open leaves the cursor's blink timer
      // pending when the tree is torn down.
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
    });
  });
}

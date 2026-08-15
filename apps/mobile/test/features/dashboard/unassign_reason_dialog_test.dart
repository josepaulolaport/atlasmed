import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/unassign_reason_dialog.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The one dialog behind every "desassociar".
///
/// It used to be private to Desempenho's breakdown, while the clinic detail had
/// a bare yes/no that sent no motivo at all — so the server filed those under
/// `manual_unassign`, the catch-all that means *reason unrecorded*. Both doors
/// now come through here, which is only worth anything if this dialog cannot
/// return without a reason.

/// Opens the dialog and hands back a box the chosen reason lands in.
///
/// A box rather than the future itself: the test has to pump the dialog's own
/// taps before the future can complete, so awaiting it here would deadlock.
Future<List<UnassignReason?>> open(
  WidgetTester tester, {
  String? memberName,
}) async {
  final chosen = <UnassignReason?>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              chosen.add(
                await UnassignReasonDialog.show(
                  context,
                  clinicName: 'Clínica Santa Rita',
                  memberName: memberName,
                ),
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
  return chosen;
}

void main() {
  testWidgets('offers every motivo the API accepts', (tester) async {
    await open(tester);

    for (final reason in UnassignReason.values) {
      expect(
        find.text(reason.label),
        findsOneWidget,
        reason: '${reason.wireValue} has no option',
      );
    }
  });

  testWidgets('names the person when the screen knows one', (tester) async {
    await open(tester, memberName: 'Flavio Ramalho');

    expect(
      find.text('Clínica Santa Rita deixará de estar com Flavio Ramalho.'),
      findsOneWidget,
    );
  });

  testWidgets('speaks about the clinic when it does not', (tester) async {
    // Reached from the clinic detail, where the point is the clinic rather
    // than whose caseload it is leaving.
    await open(tester);

    expect(
      find.text('Clínica Santa Rita deixará de ter representante.'),
      findsOneWidget,
    );
  });

  testWidgets('returns the motivo that was chosen, not the default', (
    tester,
  ) async {
    // A dialog that always returned `repChanged` would look identical on
    // screen, and every removal would be filed under the wrong reason.
    final chosen = await open(tester);

    await tester.tap(find.text(UnassignReason.clinicClosed.label));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Desassociar'));
    await tester.pumpAndSettle();

    expect(chosen.single, UnassignReason.clinicClosed);
  });

  testWidgets('cancelling returns nothing at all', (tester) async {
    // Null, not a default reason — the caller must be able to tell "no" from
    // "yes, for the first reason on the list".
    final chosen = await open(tester);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsNothing);
    expect(chosen.single, isNull);
  });

  testWidgets('the confirm reads as the destructive one', (tester) async {
    // It was grey text beside a blue neutral action on the clinic detail —
    // the destructive control was the quieter of the two.
    await open(tester);

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    final background = button.style?.backgroundColor?.resolve({});
    expect(background, AppColors.red);
  });
}

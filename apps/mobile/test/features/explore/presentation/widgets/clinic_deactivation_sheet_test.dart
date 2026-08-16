import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_deactivation_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Opens the sheet the way the clinic page does, at phone width.
Widget _host() => ProviderScope(
  child: MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 402,
          child: Consumer(
            builder: (context, ref, _) => ElevatedButton(
              onPressed: () => requestClinicDeactivation(
                context,
                ref: ref,
                clinicId: 1,
                clinicName: 'Rfl Trauma Ortopedia',
                currentStatus: FacilityCommercialStatus.registered,
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ),
  ),
);

Future<void> _openSheet(WidgetTester tester) async {
  await tester.pumpWidget(_host());
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the send button is dead until a reason is given', (
    tester,
  ) async {
    await _openSheet(tester);

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('deactivation-submit')),
    );
    expect(
      button.onPressed,
      isNull,
      reason:
          'an enabled button that silently ignores the press reads as broken',
    );
    expect(
      find.text('Obrigatório — quem revisar precisa saber o porquê.'),
      findsOneWidget,
    );
  });

  testWidgets('typing a reason enables it', (tester) async {
    // Stops at the button's state on purpose: pressing it hands off to the
    // real suggestions repository, and what changed here is the gate.
    await _openSheet(tester);

    await tester.enterText(
      find.byKey(const Key('deactivation-reason')),
      'Clínica fechou',
    );
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('deactivation-submit')),
    );
    expect(button.onPressed, isNotNull);
  });

  testWidgets('whitespace alone does not count as a reason', (tester) async {
    await _openSheet(tester);

    await tester.enterText(
      find.byKey(const Key('deactivation-reason')),
      '    ',
    );
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('deactivation-submit')),
    );
    expect(button.onPressed, isNull);
  });
}

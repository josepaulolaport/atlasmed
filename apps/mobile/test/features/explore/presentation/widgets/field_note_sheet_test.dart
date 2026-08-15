import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The clinic's field-notes card, at phone width, with nothing saved yet.
///
/// `facilityId: 0` keeps the card in its local mode, so saving never reaches
/// the network — what is under test is the button's gate, not the request.
Widget _host() => ProviderScope(
  overrides: [
    facilityNotesProvider(
      0,
    ).overrideWith((ref) async => const <FacilityFieldNote>[]),
    canMutateFacilityProvider.overrideWithValue(true),
  ],
  child: const MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 402,
          child: ClinicFieldNotesSection(facilityId: 0),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('an empty note cannot be saved', (tester) async {
    // The bug: Salvar popped the empty string, the caller discarded it, and
    // the sheet closed exactly as a successful save does — so it looked like
    // the note had been written when nothing had.
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Adicionar nota'));
    await tester.pumpAndSettle();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('field-note-save')),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets('typing a note enables saving', (tester) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Adicionar nota'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Portaria fecha às 18h');
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('field-note-save')),
    );
    expect(button.onPressed, isNotNull);
  });

  testWidgets('whitespace is not a note', (tester) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Adicionar nota'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '   ');
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.byKey(const Key('field-note-save')),
    );
    expect(button.onPressed, isNull);
  });
}

import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_header_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _facility = Facility(id: 1, name: 'Clínica Central');

void main() {
  testWidgets('header renders identity for a loaded facility', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicHeaderSection(
              detail: _facility,
              sections: null,
              photos: null,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Clínica Central'), findsOneWidget);
  });

  testWidgets('field notes shows loading indicator while notes resolve', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          facilityNotesProvider(1).overrideWith((ref) async {
            await Future<void>.delayed(const Duration(days: 1));
            return const [];
          }),
        ],
        child: const MaterialApp(
          home: Scaffold(body: ClinicFieldNotesSection(facilityId: 1)),
        ),
      ),
    );

    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('potential prompts for linha selection before loading data', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicPotentialSection(facilityId: 1, canEdit: true),
          ),
        ),
      ),
    );

    expect(find.text('Potencial & share'), findsOneWidget);
    expect(
      find.text('Selecione uma linha comercial para ver o potencial.'),
      findsOneWidget,
    );
  });
}

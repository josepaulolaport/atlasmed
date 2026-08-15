import 'package:atlasmed_mobile_app/features/explore/data/domain/professional.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/visit_scheduling.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _clinics = [
  ProfessionalClinic(
    id: 11,
    name: 'Clínica Central',
    role: 'Cirurgião',
    days: 'Seg, Qua',
    isMain: true,
  ),
  ProfessionalClinic(id: 22, name: 'Hospital São Lucas', role: '', days: 'Sex'),
];

/// A phone-width host — the sheet has to hold up where it is actually used,
/// not at the 800px test default.
Widget _host({
  required List<ProfessionalClinic> clinics,
  required void Function(ProfessionalClinic?) onResult,
}) => MaterialApp(
  home: Scaffold(
    body: Center(
      child: SizedBox(
        width: 402,
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              final chosen = await showVisitClinicChooser(
                context,
                doctorName: 'Dra. Helena Braga',
                clinics: clinics,
              );
              onResult(chosen);
            },
            child: const Text('agendar'),
          ),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('lists every clinic the doctor attends, with its meta', (
    tester,
  ) async {
    ProfessionalClinic? result;
    var called = false;
    await tester.pumpWidget(
      _host(
        clinics: _clinics,
        onResult: (value) {
          result = value;
          called = true;
        },
      ),
    );

    await tester.tap(find.text('agendar'));
    await tester.pumpAndSettle();

    expect(find.text('Dra. Helena Braga'), findsOneWidget);
    expect(find.text('Em qual clínica será a visita?'), findsOneWidget);
    expect(find.text('Clínica Central'), findsOneWidget);
    expect(find.text('Hospital São Lucas'), findsOneWidget);
    expect(find.text('principal · Cirurgião · Seg, Qua'), findsOneWidget);
    expect(called, isFalse);

    await tester.tap(find.text('Hospital São Lucas'));
    await tester.pumpAndSettle();

    // The clinic tapped, not the main one.
    expect(result?.id, 22);
  });

  testWidgets('no territory clinics means no sheet to choose from', (
    tester,
  ) async {
    // The caller then opens the editor with a blank clinic field instead of
    // dead-ending — an admin holds no territory, so this is the common case,
    // not the rare one.
    ProfessionalClinic? result;
    await tester.pumpWidget(
      _host(clinics: const [], onResult: (value) => result = value),
    );

    await tester.tap(find.text('agendar'));
    await tester.pumpAndSettle();

    expect(find.text('Em qual clínica será a visita?'), findsNothing);
    expect(result, isNull);
  });

  testWidgets('dismissing without choosing schedules nothing', (tester) async {
    ProfessionalClinic? result;
    var called = false;
    await tester.pumpWidget(
      _host(
        clinics: _clinics,
        onResult: (value) {
          result = value;
          called = true;
        },
      ),
    );

    await tester.tap(find.text('agendar'));
    await tester.pumpAndSettle();
    // Tap the barrier above the sheet.
    await tester.tapAt(const Offset(200, 40));
    await tester.pumpAndSettle();

    expect(called, isTrue);
    expect(result, isNull);
  });
}

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/calendar_facility_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _central = CalendarIdentity(id: 11, name: 'Clínica Central');
const _saoLucas = CalendarIdentity(id: 22, name: 'Hospital São Lucas');

/// Phone width — the field has to hold up where it is used, not at the 800px
/// test default.
Widget _host({
  required CalendarFacilityChoice choice,
  CalendarIdentity? selected,
  int? personId,
  List<CalendarIdentity>? clinics,
  ValueChanged<CalendarIdentity?>? onChanged,
}) => ProviderScope(
  overrides: [
    if (personId != null && clinics != null)
      professionalClinicsProvider(
        personId,
      ).overrideWith((ref) async => clinics),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 402,
          child: CalendarFacilitySelector(
            choice: choice,
            personId: personId,
            selected: selected,
            onChanged: onChanged ?? (_) {},
          ),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('opened from a clinic, the clinic is shown and not searchable', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(choice: CalendarFacilityChoice.fixed, selected: _central),
    );
    await tester.pumpAndSettle();

    expect(find.text('Clínica Central'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);
    // No search box to retype what is already known.
    expect(find.byKey(const Key('calendar-facility')), findsNothing);
    expect(
      find.text('Definida pela clínica de onde a visita foi aberta.'),
      findsOneWidget,
    );
  });

  testWidgets('opened from a doctor, only that doctor\'s clinics are offered', (
    tester,
  ) async {
    CalendarIdentity? chosen;
    await tester.pumpWidget(
      _host(
        choice: CalendarFacilityChoice.professionalClinics,
        personId: 138,
        clinics: const [_central, _saoLucas],
        onChanged: (value) => chosen = value,
      ),
    );
    await tester.pumpAndSettle();

    // A dropdown of his clinics, not a search over every clinic.
    expect(find.byKey(const Key('calendar-facility')), findsNothing);
    expect(find.text('Onde este médico atende'), findsOneWidget);

    await tester.tap(find.byKey(const Key('calendar-facility-professional')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hospital São Lucas').last);
    await tester.pumpAndSettle();

    expect(chosen?.id, 22);
  });

  testWidgets('a doctor with no clinics falls back to searching, not a wall', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        choice: CalendarFacilityChoice.professionalClinics,
        personId: 138,
        clinics: const [],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('calendar-facility')), findsOneWidget);
    expect(
      find.text(
        'Este médico não tem clínicas vinculadas. Busque a clínica da visita.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('from the agenda itself, every clinic is searchable', (
    tester,
  ) async {
    await tester.pumpWidget(_host(choice: CalendarFacilityChoice.anyClinic));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('calendar-facility')), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline_rounded), findsNothing);
  });
}

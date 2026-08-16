import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pump(WidgetTester tester, Widget child) => tester.pumpWidget(
  MaterialApp(
    home: Scaffold(body: ListView(children: [child])),
  ),
);

void main() {
  testWidgets('the summary row draws the name and the place it was given', (
    tester,
  ) async {
    await _pump(
      tester,
      ClinicRow.summary(
        name: 'Centro Medico Matsumoto',
        location: 'Brasília — DF',
        onTap: () {},
      ),
    );

    expect(find.text('Centro Medico Matsumoto'), findsOneWidget);
    expect(find.text('Brasília — DF'), findsOneWidget);
  });

  testWidgets('the summary row invents no doctor count and no clinical focus', (
    tester,
  ) async {
    await _pump(
      tester,
      ClinicRow.summary(name: 'Clínica X', location: 'Rio', onTap: () {}),
    );

    expect(find.textContaining('médico'), findsNothing);
    expect(find.text('Sem foco clínico'), findsNothing);
  });

  testWidgets('the full row still reports what the entry carries', (
    tester,
  ) async {
    await _pump(
      tester,
      ClinicRow(
        clinic: const FacilityEntry(
          id: 1,
          name: 'Clínica Y',
          city: 'Rio',
          doctorCount: 3,
        ),
        onTap: () {},
      ),
    );

    expect(find.text('3 médicos'), findsOneWidget);
    expect(find.text('Sem foco clínico'), findsOneWidget);
  });

  testWidgets('badges and trailing render on the summary row', (tester) async {
    await _pump(
      tester,
      ClinicRow.summary(
        name: 'Clínica Z',
        location: 'Niterói',
        badges: const [Text('Fora do território')],
        trailing: const Icon(Icons.add_circle_outline_rounded),
        onTap: () {},
      ),
    );

    expect(find.text('Fora do território'), findsOneWidget);
    expect(find.byIcon(Icons.add_circle_outline_rounded), findsOneWidget);
  });
}

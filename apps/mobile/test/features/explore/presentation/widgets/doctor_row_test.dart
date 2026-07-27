import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders priority indicator and clinic before CRM', (
    tester,
  ) async {
    const doctor = ProfessionalEntry(
      id: 'professional-1',
      name: 'Ana Silva',
      initials: 'AS',
      hue: 0,
      specialty: 'Cardiologia',
      displayFacilityName: 'Clínica Central',
      crm: 'CRM-SP 12345',
      isPriority: true,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DoctorRow(doctor: doctor, onTap: _noop),
        ),
      ),
    );

    expect(find.byKey(const Key('doctor-priority-indicator')), findsOneWidget);
    expect(find.text('Clínica Central · CRM-SP 12345'), findsOneWidget);
  });
}

void _noop() {}

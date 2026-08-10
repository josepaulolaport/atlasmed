import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_crm_doctors_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders doctors as a vertical tile list', (tester) async {
    const doctors = [
      ProfessionalRoster(
        id: 1,
        name: 'Dra. Ana Lima',
        initials: 'AL',
        hue: 210,
        specialty: 'Cardiologia',
        crm: 'CRM 1234',
      ),
      ProfessionalRoster(
        id: 2,
        name: 'Dr. Bruno Reis',
        initials: 'BR',
        hue: 140,
        specialty: 'Ortopedia',
        crm: 'CRM 5678',
      ),
    ];

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClinicCrmDoctorsSection(doctors: doctors, facilityId: 10),
          ),
        ),
      ),
    );

    expect(find.byType(PageView), findsNothing);
    expect(find.byType(CircleAvatar), findsNWidgets(2));
    expect(find.text('Dra. Ana Lima'), findsOneWidget);
    expect(find.text('Dr. Bruno Reis'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Dr. Bruno Reis')).dy,
      greaterThan(tester.getTopLeft(find.text('Dra. Ana Lima')).dy),
    );
  });
}

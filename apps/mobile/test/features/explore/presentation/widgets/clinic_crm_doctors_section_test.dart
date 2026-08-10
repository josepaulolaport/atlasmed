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

  testWidgets('editable tile fits a narrow screen with larger text', (
    tester,
  ) async {
    const doctor = ProfessionalRoster(
      id: 1,
      name: 'Dra. Ana Carolina Lima de Oliveira',
      initials: 'AL',
      hue: 210,
      specialty: 'Cardiologia intervencionista',
      crm: 'CRM 123456 SP',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 800),
              textScaler: TextScaler.linear(1.4),
            ),
            child: SizedBox(
              width: 320,
              child: ClinicCrmDoctorsSection(
                doctors: const [doctor],
                facilityId: 10,
                onDoctorUpdated: (_) {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Definir papel'), findsOneWidget);
  });
}

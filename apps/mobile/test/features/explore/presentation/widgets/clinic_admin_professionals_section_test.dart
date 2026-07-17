import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_professionals_section.dart';

void main() {
  testWidgets('renders administrative professional rows', (tester) async {
    const professionals = [
      AdministrativeProfessional(
        id: '1',
        name: 'Carlos Mendes',
        roleTitle: 'Diretor administrativo',
        email: 'carlos@test.com',
        phone: '11999999999',
        contactType: 'DECISOR',
      ),
    ];

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ClinicAdminProfessionalsSection(
            professionals: professionals,
            facilityName: 'Clínica Teste',
          ),
        ),
      ),
    );

    expect(find.text('Carlos Mendes'), findsOneWidget);
    expect(find.text('Diretor administrativo'), findsOneWidget);
    expect(find.text('Decisor'), findsOneWidget);
  });

  testWidgets('shows empty state', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ClinicAdminProfessionalsSection(
            professionals: [],
            facilityName: 'Clínica Teste',
          ),
        ),
      ),
    );

    expect(
      find.text('Nenhum contato administrativo cadastrado'),
      findsOneWidget,
    );
  });
}

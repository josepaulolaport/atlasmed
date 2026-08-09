import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_professionals_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_page_view.dart';

void main() {
  setUp(() {
    PersonFacilityRoleCatalogCache.replace(const [
      PersonFacilityRoleCatalogEntry(id: 3, name: 'Decisor'),
    ]);
  });

  tearDown(PersonFacilityRoleCatalogCache.resetForTest);

  testWidgets('renders administrative professional rows', (tester) async {
    const professionals = [
      AdministrativeProfessional(
        id: 1,
        name: 'Carlos Mendes',
        roleTitle: 'Diretor administrativo',
        email: 'carlos@test.com',
        phone: '11999999999',
        contactType: 'DECISOR',
        roleIds: [3],
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

  testWidgets(
    'does not reserve a trailing placeholder while pagination is idle',
    (tester) async {
      const professionals = [
        AdministrativeProfessional(
          id: 1,
          name: 'Carlos Mendes',
          roleTitle: 'Diretor administrativo',
          email: 'carlos@test.com',
          phone: '11999999999',
          contactType: 'DECISOR',
          roleIds: [3],
        ),
      ];

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ClinicAdminProfessionalsSection(
              professionals: professionals,
              facilityName: 'Clínica Teste',
              hasMore: true,
            ),
          ),
        ),
      );

      expect(find.byType(FacilityRosterPaginationSkeleton), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Carregando…'), findsNothing);
    },
  );
}

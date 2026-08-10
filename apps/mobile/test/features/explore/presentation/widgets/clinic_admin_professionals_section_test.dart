import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_professionals_section.dart';

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
      AdministrativeProfessional(
        id: 2,
        name: 'Marina Alves',
        roleTitle: 'Gerente',
        email: 'marina@test.com',
        phone: '11888888888',
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
    expect(find.text('Marina Alves'), findsOneWidget);
    expect(find.byType(PageView), findsNothing);
    expect(
      tester.getTopLeft(find.text('Marina Alves')).dy,
      greaterThan(tester.getTopLeft(find.text('Carlos Mendes')).dy),
    );
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

      expect(find.byType(PageView), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Carregando…'), findsNothing);
    },
  );

  testWidgets('tile fits a narrow screen with larger text', (tester) async {
    const professional = AdministrativeProfessional(
      id: 1,
      name: 'Carlos Eduardo Mendes de Albuquerque',
      roleTitle: 'Diretor administrativo e financeiro',
      contactType: 'DECISOR',
      roleIds: [3],
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: MediaQueryData(
              size: Size(320, 800),
              textScaler: TextScaler.linear(1.4),
            ),
            child: SizedBox(
              width: 320,
              child: ClinicAdminProfessionalsSection(
                professionals: [professional],
                facilityName: 'Clínica Teste',
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Decisor'), findsOneWidget);
  });
}

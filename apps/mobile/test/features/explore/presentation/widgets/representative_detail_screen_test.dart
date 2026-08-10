import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    PersonFacilityRoleCatalogCache.replace(const [
      PersonFacilityRoleCatalogEntry(id: 3, name: 'Decisor'),
    ]);
  });

  tearDown(PersonFacilityRoleCatalogCache.resetForTest);

  testWidgets('presents the administrative contact hierarchy and actions', (
    tester,
  ) async {
    await tester.pumpWidget(_app());

    expect(find.text('Contato administrativo'), findsOneWidget);
    expect(find.text('Carlos Mendes'), findsOneWidget);
    expect(find.text('Diretor administrativo'), findsOneWidget);
    expect(find.text('Decisor'), findsOneWidget);
    expect(find.text('Ligar'), findsOneWidget);
    expect(find.text('Enviar e-mail'), findsOneWidget);
    expect(find.text('Relacionamento'), findsOneWidget);
    expect(find.text('Não avaliado'), findsOneWidget);
    expect(find.text('Dados de contato'), findsOneWidget);
    expect(find.byTooltip('Copiar Telefone'), findsOneWidget);
    expect(find.byTooltip('Copiar E-mail'), findsOneWidget);
    expect(find.text('Perfil do profissional'), findsNothing);

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('Vínculo'), findsOneWidget);
    expect(find.text('Clínica Santa Helena'), findsOneWidget);
  });

  testWidgets('fits a narrow screen with larger text', (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app(textScaler: const TextScaler.linear(1.4)));

    expect(tester.takeException(), isNull);
    expect(find.text('Carlos Mendes'), findsOneWidget);
    expect(find.text('Ligar'), findsOneWidget);
    expect(find.text('Enviar e-mail'), findsOneWidget);
  });
}

Widget _app({TextScaler? textScaler}) {
  return ProviderScope(
    overrides: [canMutateProfessionalProvider.overrideWithValue(false)],
    child: MaterialApp(
      theme: AppTheme.light,
      builder: textScaler == null
          ? null
          : (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: textScaler),
              child: child!,
            ),
      home: const RepresentativeDetailScreen(
        professional: AdministrativeProfessional(
          id: 1,
          name: 'Carlos Mendes',
          roleTitle: 'Diretor administrativo',
          email: 'carlos.mendes@clinica.com.br',
          phone: '(11) 99999-9999',
          roleIds: [3],
        ),
        facilityName: 'Clínica Santa Helena',
      ),
    ),
  );
}

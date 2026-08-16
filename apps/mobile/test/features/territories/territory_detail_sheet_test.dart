import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/user_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_detail_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _zoneType = TerritoryType(id: 1, slug: 'manager_zone', name: 'Zona');

Territory zone({int assignedUserCount = 1, int? assignedUserId = 7}) =>
    Territory(
      id: 3,
      name: 'Norte',
      slug: 'orto-mz-no',
      verticalId: 1,
      territoryType: _zoneType,
      clinicCount: 445,
      assignedUserCount: assignedUserCount,
      repPatchCount: 1,
      boundary: TerritoryGeometry.polygon(const []),
      centroid: const MapCoordinate(longitude: -50, latitude: -5),
      assignedUserId: assignedUserId,
    );

Future<void> pumpSheet(
  WidgetTester tester,
  Territory territory, {
  String holderName = 'Silvio Vieira',
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        userByIdProvider.overrideWith(
          (ref, id) async =>
              AppUser(id: id, name: holderName, role: UserRole.manager),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: TerritoryDetailSheet(territory: territory)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a long holder name does not overflow the sheet', (tester) async {
    // Two unconstrained Texts in a spaceBetween Row — and the holder's full
    // name is one of the values.
    await pumpSheet(
      tester,
      zone(),
      holderName: 'Maria Auxiliadora do Nascimento Vasconcelos Albuquerque',
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('the holder is labelled the way the map card labels them', (
    tester,
  ) async {
    // "Gerente responsável" here, "Gerente:" on the card, "Responsável" on the
    // button — three phrasings of one relationship.
    await pumpSheet(tester, zone());

    expect(find.text('Gerente'), findsOneWidget);
    expect(find.text('Gerente responsável'), findsNothing);
  });

  testWidgets('one holder is not also counted as an assigned user', (
    tester,
  ) async {
    // The count is holders plus pending invitations, so the ordinary zone read
    // "Usuários atribuídos: 1" right under that holder's name.
    await pumpSheet(tester, zone());

    expect(find.text('Usuários atribuídos'), findsNothing);
  });

  testWidgets('a pending invitation is worth counting', (tester) async {
    await pumpSheet(tester, zone(assignedUserCount: 2));

    expect(find.text('Usuários atribuídos'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });
}

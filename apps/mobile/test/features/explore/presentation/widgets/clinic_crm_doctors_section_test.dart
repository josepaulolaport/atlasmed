import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_crm_doctors_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The compact "Médicos" list on the clinic detail.
///
/// The role chips sat in a trailing column capped at 140px. A doctor holding
/// four of them — Prescritor, Comprador, Decisor, Administrador — got one chip
/// per line, four lines tall, and the name column beside it shrank until the
/// name ellipsised: "Leonardo De Oliv…".

ProfessionalRoster doctor({
  String name = 'Leonardo De Oliveira e Xerez',
  List<int> roleIds = const [],
}) {
  return ProfessionalRoster(
    id: 1,
    personFacilityId: 10,
    name: name,
    initials: initialsFromName(name),
    hue: hueFromName(name),
    crm: 'CRM/RJ 491826',
    roleIds: roleIds,
  );
}

Future<void> pumpSection(
  WidgetTester tester, {
  required ProfessionalRoster row,
  bool canEditRoles = true,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: SingleChildScrollView(
          // Phone width, because that is the only place the bug lives: the
          // default 800px test viewport leaves room for both the name and a
          // 140px chip gutter, so the squeeze never happens and the test
          // passes against the broken layout.
          child: SizedBox(
            width: 402,
            child: ClinicCrmDoctorsSection(
              doctors: [row],
              facilityId: 9,
              onDoctorUpdated: canEditRoles ? (_) {} : null,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The four roles from the screenshot that started this.
const _catalogue = [
  PersonFacilityRoleCatalogEntry(id: 1, name: 'Prescritor'),
  PersonFacilityRoleCatalogEntry(id: 2, name: 'Comprador'),
  PersonFacilityRoleCatalogEntry(id: 3, name: 'Decisor'),
  PersonFacilityRoleCatalogEntry(id: 4, name: 'Administrador'),
];

void main() {
  // Chips resolve their labels through this cache. Without it every roleId
  // renders nothing, and the assertions below would pass over an empty row.
  setUp(() => PersonFacilityRoleCatalogCache.replace(_catalogue));
  tearDown(PersonFacilityRoleCatalogCache.resetForTest);

  final fourRoles = PersonFacilityRoleCatalog.sortedIds(const [1, 2, 3, 4]);

  testWidgets('the name is not squeezed by the chips beside it', (
    tester,
  ) async {
    await pumpSection(tester, row: doctor(roleIds: fourRoles));

    final name = tester.widget<Text>(find.text('Leonardo De Oliveira e Xerez'));
    // Still one line and still ellipsising if it must — but it must not have
    // to. The column it lives in should now span most of the row.
    final size = tester.getSize(find.text('Leonardo De Oliveira e Xerez'));
    expect(name.maxLines, 1);
    expect(
      size.width,
      greaterThan(200),
      reason: 'the name column lost its room to the chip gutter',
    );
  });

  testWidgets('several roles wrap across the width, not down a column', (
    tester,
  ) async {
    await pumpSection(tester, row: doctor(roleIds: fourRoles));

    final labels = PersonFacilityRoleCatalog.labelsFor(fourRoles, _catalogue);
    expect(labels, hasLength(4), reason: 'no chips means this proves nothing');

    // How many distinct rows the chips occupy. In the 140px gutter each chip
    // got a line of its own; across the full width they share far fewer.
    final rows = <double>{
      for (final label in labels) tester.getTopLeft(find.text(label)).dy,
    };
    expect(rows.length, lessThan(labels.length));
  });

  testWidgets('the pencil keeps a 44px target of its own', (tester) async {
    await pumpSection(tester, row: doctor(roleIds: fourRoles));

    final pencil = find.byIcon(Icons.edit_outlined);
    expect(pencil, findsOneWidget);
    final box = tester.getSize(
      find.ancestor(of: pencil, matching: find.byType(SizedBox)).first,
    );
    expect(box.width, 44);
    expect(box.height, 44);
  });

  testWidgets('offers to set a role when there is none', (tester) async {
    await pumpSection(tester, row: doctor());

    expect(find.text('Definir papel'), findsOneWidget);
  });

  testWidgets('a read-only row shows neither prompt nor pencil', (
    tester,
  ) async {
    await pumpSection(tester, row: doctor(), canEditRoles: false);

    expect(find.text('Definir papel'), findsNothing);
    expect(find.byIcon(Icons.edit_outlined), findsNothing);
  });
}

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/member_territory_map.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/team_member_screen.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _LoadedProfile extends Repository<TeamMemberProfile> {
  _LoadedProfile(this.profile)
    : super(
        name: 'FakeMemberRepository',
        endpoint: Uri.parse('http://localhost/team/members/5'),
        resolveOnCreate: false,
      ) {
    emit(data: profile);
  }

  final TeamMemberProfile profile;

  @override
  Future<TeamMemberProfile?> currentValueOrResolve() async {
    await emit(data: profile);
    return profile;
  }
}

TeamMemberProfile _profile({
  String role = 'REP',
  int clinics = 242,
  int outOfTerritory = 0,
  String status = 'ACTIVE',
  String? phone = '+55 21 99999-0000',
}) => TeamMemberProfile(
  userId: 5,
  name: 'Flavio Ramalho',
  email: 'flavio.ramalho@atlasmed.com.br',
  phoneNumber: phone,
  roleName: role,
  status: status,
  memberSince: DateTime.utc(2026, 8, 8),
  territories: const [(id: 9, name: 'Patch Flavio Ramalho')],
  assignedClinicCount: clinics,
  outOfTerritoryCount: outOfTerritory,
);

/// A territory map that is already loaded, so the profile's minimap does not
/// reach for the network in a widget test.
class _LoadedTerritory extends Repository<MemberTerritoryMap> {
  _LoadedTerritory(this.map)
    : super(
        name: 'FakeTerritoryRepository',
        endpoint: Uri.parse('http://localhost/territory-map'),
        resolveOnCreate: false,
      ) {
    emit(data: map);
  }

  final MemberTerritoryMap map;

  @override
  Future<MemberTerritoryMap?> currentValueOrResolve() async {
    await emit(data: map);
    return map;
  }
}

const _noTerritory = MemberTerritoryMap(
  subject: [],
  context: [],
  taken: [],
  canEdit: true,
);

Future<void> _pump(
  WidgetTester tester,
  TeamMemberProfile profile, {
  UserRoleName role = UserRoleName.manager,
  MemberTerritoryMap territory = _noTerritory,
}) async {
  // Tall enough to build the whole profile. A ListView does not lay out what is
  // off screen, and the cards these tests assert on sit below a phone's fold
  // now that the territory card is above them.
  tester.view.physicalSize = const Size(1200, 3200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
        currentUserRoleProvider.overrideWithValue(role),
        teamMemberProvider.overrideWith((ref, args) => _LoadedProfile(profile)),
        memberTerritoryProvider.overrideWith(
          (ref, args) => _LoadedTerritory(territory),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const TeamMemberScreen(userId: 5, memberName: 'Flavio Ramalho'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows who the person is, and what they hold', (tester) async {
    await _pump(tester, _profile());

    expect(find.text('Flavio Ramalho'), findsWidgets);
    expect(find.text('Representante'), findsOneWidget);
    expect(find.text('flavio.ramalho@atlasmed.com.br'), findsOneWidget);
    expect(find.text('Patch Flavio Ramalho'), findsOneWidget);
    expect(find.text('ago. de 2026'), findsOneWidget);
    expect(find.text('242'), findsOneWidget);
  });

  testWidgets('leads to Desempenho rather than repeating it', (tester) async {
    await _pump(tester, _profile());

    // Equipe answers who; the numbers live one tap away. A profile that
    // reproduced the cards would be a second, quietly diverging dashboard.
    expect(find.text('Desempenho'), findsOneWidget);
    expect(find.text('Cobertura'), findsNothing);
    expect(find.text('Penetração média'), findsNothing);
  });

  testWidgets('says nothing about out-of-territory when there is none', (
    tester,
  ) async {
    await _pump(tester, _profile());
    expect(find.text('Clínicas fora do território'), findsNothing);
  });

  testWidgets('surfaces overrides when they exist (0009 R2)', (tester) async {
    await _pump(tester, _profile(outOfTerritory: 3));

    expect(find.text('Clínicas fora do território'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('a rep with no patch is told what that costs them', (
    tester,
  ) async {
    // The single most useful thing this screen can say. A rep with no patch has
    // no manager, appears on no team, and can hold no clinics — an empty grey
    // map would state none of that.
    await _pump(tester, _profile());

    expect(find.text('Sem território'), findsOneWidget);
    expect(find.text('Desenhar área'), findsOneWidget);
  });

  testWidgets('a manager with no zone gets the manager wording', (
    tester,
  ) async {
    await _pump(tester, _profile(role: 'MANAGER'), role: UserRoleName.admin);
    expect(find.text('Sem zona nesta linha'), findsOneWidget);
  });

  testWidgets('a rep has no team to open', (tester) async {
    await _pump(tester, _profile(), role: UserRoleName.admin);
    expect(find.text('Equipe'), findsNothing);
  });

  testWidgets('an admin reaches a manager\'s reps from their profile', (
    tester,
  ) async {
    await _pump(tester, _profile(role: 'MANAGER'), role: UserRoleName.admin);
    expect(find.text('Equipe'), findsOneWidget);
  });

  testWidgets('a manager never sees a team card, even on a manager', (
    tester,
  ) async {
    // A manager's roster is their reps; there is no manager below them to open.
    await _pump(tester, _profile(role: 'MANAGER'), role: UserRoleName.manager);
    expect(find.text('Equipe'), findsNothing);
  });

  testWidgets('an account that is not active says so', (tester) async {
    // A suspended rep still holds a patch and still appears on the roster, so
    // without this nothing on screen explains why their numbers stopped.
    await _pump(tester, _profile(status: 'SUSPENDED'));
    expect(find.text('Suspenso'), findsOneWidget);
  });

  testWidgets('omits a phone row rather than showing an empty one', (
    tester,
  ) async {
    await _pump(tester, _profile(phone: null));
    expect(find.text('Telefone'), findsNothing);
    expect(find.text('E-mail'), findsOneWidget);
  });
}

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/team_screen.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A roster that is already loaded, so the screen renders without HTTP.
class _LoadedRoster extends Repository<List<TeamMember>> {
  _LoadedRoster(this.members)
    : super(
        name: 'FakeTeamRepository',
        endpoint: Uri.parse('http://localhost/team'),
        resolveOnCreate: false,
      ) {
    emit(data: members);
  }

  final List<TeamMember> members;

  @override
  Future<List<TeamMember>?> currentValueOrResolve() async {
    await emit(data: members);
    return members;
  }
}

TeamMember _member({
  required int userId,
  required String name,
  String role = 'REP',
  int clinics = 10,
  double? coverage = 0.5,
  int orders = 3,
  List<({int id, String name})> territories = const [],
}) => TeamMember(
  userId: userId,
  name: name,
  email: '${name.toLowerCase()}@atlasmed.com.br',
  roleName: role,
  territories: territories,
  assignedClinicCount: clinics,
  metrics: TeamMemberMetrics(
    assignedClinics: clinics,
    coveragePercent: coverage,
    cadastroPercent: 0,
    ordersMonth: orders,
  ),
);

Future<void> _pump(
  WidgetTester tester,
  List<TeamMember> members, {
  UserRoleName role = UserRoleName.manager,
  int? managerId,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
        currentUserRoleProvider.overrideWithValue(role),
        teamProvider.overrideWith((ref, args) => _LoadedRoster(members)),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: TeamScreen(managerId: managerId, managerName: 'Silvio'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('every row shows all three figures, whatever the sort', (
    tester,
  ) async {
    await _pump(tester, [
      _member(userId: 5, name: 'Ana', clinics: 242, coverage: 0.05, orders: 5),
      _member(
        userId: 6,
        name: 'Bruno',
        clinics: 447,
        coverage: 0.01,
        orders: 1,
      ),
    ]);

    // The redesign's whole claim: a row is readable on its own terms, not only
    // through the column it happens to be ordered by. Sorting by name used to
    // mean no figures at all.
    expect(find.text('242'), findsOneWidget);
    expect(find.text('447'), findsOneWidget);
    expect(find.text('5%'), findsOneWidget);
    expect(find.text('1%'), findsOneWidget);
    expect(find.text('Clínicas'), findsWidgets);
    expect(find.text('Pedidos'), findsNWidgets(2));
  });

  testWidgets('the header totals the roster, weighting coverage by clinics', (
    tester,
  ) async {
    await _pump(tester, [
      _member(userId: 5, name: 'Ana', clinics: 100, coverage: 1, orders: 4),
      _member(userId: 6, name: 'Bruno', clinics: 300, coverage: 0, orders: 2),
    ]);

    expect(find.text('2 representantes'), findsOneWidget);
    expect(find.text('400'), findsOneWidget);
    // A mean of the two percentages would say 50%; weighting says 25%, which
    // is the share of the team's clinics actually covered.
    expect(find.text('25%'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
  });

  testWidgets('a percentage with no clinics reads as absent, not as zero', (
    tester,
  ) async {
    await _pump(tester, [
      _member(userId: 5, name: 'Ana', clinics: 0, coverage: null, orders: 0),
    ]);

    expect(find.text('—'), findsWidgets);
    expect(find.text('0%'), findsNothing);
  });

  testWidgets('a small roster needs no search — you can see all of it', (
    tester,
  ) async {
    await _pump(tester, [_member(userId: 5, name: 'Ana')]);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('at scale, search filters the roster', (tester) async {
    await _pump(tester, [
      for (var i = 0; i < 9; i++)
        _member(userId: i + 1, name: i == 0 ? 'Ana' : 'Pessoa$i'),
    ]);
    expect(find.byType(TextField), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'ana');
    await tester.pumpAndSettle();

    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Pessoa3'), findsNothing);
  });

  testWidgets('a search matching nobody says so', (tester) async {
    await _pump(tester, [
      for (var i = 0; i < 9; i++) _member(userId: i + 1, name: 'Pessoa$i'),
    ]);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();

    expect(find.textContaining('corresponde a "zzz"'), findsOneWidget);
  });

  testWidgets('a manager row offers the person and the team separately', (
    tester,
  ) async {
    await _pump(tester, [
      _member(userId: 2, name: 'Silvio', role: 'MANAGER', clinics: 1134),
    ], role: UserRoleName.admin);

    // Tapping the row used to open the manager's *team*, which left their own
    // Desempenho behind a second icon and made a row mean two things by role.
    // Now the row is the person and the team has the control.
    expect(find.byIcon(Icons.groups_rounded), findsOneWidget);
    expect(find.byIcon(Icons.insights_rounded), findsNothing);
  });
}

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
class _LoadedRoster extends Repository<TeamRoster> {
  _LoadedRoster(this.members, {this.invites = const []})
    : super(
        name: 'FakeTeamRepository',
        endpoint: Uri.parse('http://localhost/team'),
        resolveOnCreate: false,
      ) {
    emit(data: _roster);
  }

  final List<TeamMember> members;
  final List<PendingInvite> invites;

  TeamRoster get _roster =>
      TeamRoster(members: members, pendingInvites: invites);

  @override
  Future<TeamRoster?> currentValueOrResolve() async {
    await emit(data: _roster);
    return _roster;
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
  UserRoleName? role = UserRoleName.manager,
  int? managerId,
  List<PendingInvite> invites = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
        currentUserRoleProvider.overrideWithValue(role),
        teamProvider.overrideWith(
          (ref, args) => _LoadedRoster(members, invites: invites),
        ),
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

  testWidgets('names the roster from its own rows, not from the viewer', (
    tester,
  ) async {
    // `currentUserRoleProvider` resolves a beat after sign-in, and the header
    // used to read `role != manager` — so an unresolved role counted as admin
    // and a manager who had just logged in saw their reps headed "3 gestores".
    // The response already says who these people are.
    await _pump(tester, [
      _member(userId: 5, name: 'Ana'),
      _member(userId: 6, name: 'Bruno'),
    ], role: null);

    expect(find.text('2 representantes'), findsOneWidget);
    expect(find.text('2 gestores'), findsNothing);
  });

  testWidgets('a roster of managers is named as one', (tester) async {
    await _pump(tester, [
      _member(userId: 2, name: 'Silvio', role: 'MANAGER'),
    ], role: null);

    expect(find.text('1 gestor'), findsOneWidget);
  });

  testWidgets('a card never mentions territory, however much someone holds', (
    tester,
  ) async {
    // Equipe answers *who*, not *where*. Territory came off these cards with
    // the redesign, and the roster's search went with it — a term that matched
    // something no longer on screen reads as a broken search, not a clever one.
    await _pump(tester, [
      _member(
        userId: 5,
        name: 'Ana',
        territories: const [(id: 9, name: 'Patch Ana')],
      ),
    ]);

    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Patch Ana'), findsNothing);
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

  testWidgets('someone invited holds the ground before they arrive', (
    tester,
  ) async {
    // Spec 0015 R11. The roster is built on `users`, so until now you could
    // invite a rep, draw their patch, and the team screen showed nothing —
    // while the clinics inside that patch sat unstaffed.
    await _pump(
      tester,
      [_member(userId: 5, name: 'Ana')],
      invites: [
        PendingInvite(
          invitationId: 9,
          name: 'Novo Rep',
          email: 'novo@atlasmed.com.br',
          roleName: 'REP',
          territories: const [(id: 3, name: 'Patch Novo')],
          expiresAt: DateTime.utc(2026, 9, 1),
        ),
      ],
    );

    expect(find.text('Novo Rep'), findsOneWidget);
    expect(find.text('Convite pendente'), findsOneWidget);
    // Territory is no longer shown anywhere on Equipe, invitations included.
    expect(find.text('Patch Novo'), findsNothing);
    // Inert: there is no profile to open and no metrics to show, so it must not
    // look like a card you can tap through.
    expect(find.byIcon(Icons.hourglass_empty_rounded), findsOneWidget);
  });

  testWidgets('a team of nobody but an invitation is not empty', (
    tester,
  ) async {
    await _pump(
      tester,
      const [],
      invites: [
        PendingInvite(
          invitationId: 9,
          name: 'Novo Rep',
          roleName: 'REP',
          territories: const [],
          expiresAt: DateTime.utc(2026, 9, 1),
        ),
      ],
    );

    expect(find.text('Nenhum representante nesta equipe'), findsNothing);
    expect(find.text('Novo Rep'), findsOneWidget);
  });

  testWidgets('every row leads to one place — that person', (tester) async {
    await _pump(tester, [
      _member(userId: 2, name: 'Silvio', role: 'MANAGER', clinics: 1134),
    ], role: UserRoleName.admin);

    // A manager card used to open the manager's *team*, so "tap a person" meant
    // two different things depending on the viewer's role, and the manager's
    // own numbers needed a second icon. Spec 0015 §4 makes the card the
    // person's profile, with their team as a card inside it — so neither extra
    // control belongs on the card any more.
    expect(find.byIcon(Icons.groups_rounded), findsNothing);
    expect(find.byIcon(Icons.insights_rounded), findsNothing);
    // One card, one chevron. The "representantes sem território" band carried
    // the only other one and has gone with the rest of territory.
    expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
    expect(find.text('Representantes sem território'), findsNothing);
  });
}

import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/edit_user_assignments_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

final _adriana = User(
  id: 7,
  email: 'adriana@empresa.com.br',
  username: 'adriana.oliveira',
  firstName: 'Adriana',
  lastName: 'Oliveira',
  status: UserStatus.active,
  emailVerified: true,
  phoneVerified: true,
  twoFactorEnabled: false,
  role: const UserRole(id: 3, name: UserRoleName.rep),
  createdAt: DateTime(2026, 1, 1),
  updatedAt: DateTime(2026, 1, 1),
);

/// Ortopedia comes loaded with a manager and two territories — the state the
/// old toggle threw away.
const _ortopedia = InviteVerticalAssignment(
  verticalId: 1,
  verticalName: 'Ortopedia',
  managerDisplayName: 'Pedro Poggian',
  territories: [
    TerritoryOption(id: 11, name: 'Patch Rio'),
    TerritoryOption(id: 12, name: 'Patch Niterói'),
  ],
);

class _SpyRepository implements UsersRepository {
  List<InviteVerticalAssignment>? saved;

  @override
  Future<User?> getUserById(int id) async => _adriana;

  @override
  Future<UserAssignments> getUserAssignments(int userId) async =>
      const UserAssignments(
        userId: 7,
        isOperationallyActive: true,
        verticalAssignments: [_ortopedia],
      );

  @override
  Future<void> replaceVerticalAssignments(
    int userId,
    List<InviteVerticalAssignment> assignments,
  ) async {
    saved = assignments;
  }

  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} not stubbed');
}

Future<_SpyRepository> _pump(WidgetTester tester) async {
  final repository = _SpyRepository();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        canManageUserAdminProvider.overrideWithValue(true),
        usersRepositoryProvider.overrideWithValue(repository),
        verticalOptionsProvider.overrideWith(
          (ref) async => const [
            VerticalOption(id: 1, name: 'Ortopedia'),
            VerticalOption(id: 2, name: 'Neurocirurgia'),
          ],
        ),
      ],
      child: const MaterialApp(home: EditUserAssignmentsScreen(userId: 7)),
    ),
  );
  await tester.pump();
  await tester.pump();
  return repository;
}

void main() {
  testWidgets('removing a sector that holds work says what it costs', (
    tester,
  ) async {
    await _pump(tester);

    await tester.tap(find.text('Ortopedia'));
    await tester.pump();

    expect(find.text('Remover Ortopedia?'), findsOneWidget);
    expect(find.textContaining('o gerente'), findsOneWidget);
    expect(find.textContaining('os 2 territórios'), findsOneWidget);
  });

  testWidgets('cancelling the removal keeps the sector selected', (
    tester,
  ) async {
    final repository = await _pump(tester);

    await tester.tap(find.text('Ortopedia'));
    await tester.pump();
    await tester.tap(find.text('Cancelar'));
    await tester.pump();

    await tester.tap(find.text('Salvar linhas'));
    await tester.pump();

    expect(repository.saved?.map((a) => a.verticalId), [1]);
  });

  testWidgets('un-checking then re-checking gives the manager and the '
      'territories back', (tester) async {
    final repository = await _pump(tester);

    await tester.tap(find.text('Ortopedia'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('assignments-remove-confirm')));
    await tester.pump();

    await tester.tap(find.text('Ortopedia'));
    await tester.pump();

    await tester.tap(find.text('Salvar linhas'));
    await tester.pump();

    final saved = repository.saved;
    expect(saved, isNotNull);
    expect(saved!.single.territories.map((t) => t.name), [
      'Patch Rio',
      'Patch Niterói',
    ]);
    expect(saved.single.managerName, 'Pedro Poggian');
  });

  testWidgets('adding a sector that was never assigned needs no confirmation', (
    tester,
  ) async {
    final repository = await _pump(tester);

    await tester.tap(find.text('Neurocirurgia'));
    await tester.pump();

    expect(find.textContaining('Remover'), findsNothing);

    await tester.tap(find.text('Salvar linhas'));
    await tester.pump();

    expect(repository.saved?.map((a) => a.verticalId), [1, 2]);
  });
}

import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/change_role_sheet.dart';
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

const _roles = [
  UserRole(id: 3, name: UserRoleName.rep),
  UserRole(id: 2, name: UserRoleName.manager),
];

/// Records whether the role change actually reached the API.
class _SpyRepository implements UsersRepository {
  int calls = 0;

  @override
  Future<void> changeUserRole(int userId, int roleId) async {
    calls++;
  }

  @override
  noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} not stubbed');
}

Future<void> _pumpSheet(WidgetTester tester, _SpyRepository repository) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        rolesProvider.overrideWith((ref) async => _roles),
        usersRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp(
        home: Scaffold(body: ChangeRoleSheet(user: _adriana)),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('a role change asks first, and says the person is signed out', (
    tester,
  ) async {
    final repository = _SpyRepository();
    await _pumpSheet(tester, repository);

    await tester.tap(find.text('Gerente'));
    await tester.pump();
    await tester.tap(find.text('Salvar'));
    await tester.pump();

    expect(find.text('Tornar Adriana Oliveira Gerente?'), findsOneWidget);
    expect(
      find.textContaining('será encerrada em todos os dispositivos'),
      findsOneWidget,
    );
    expect(
      repository.calls,
      0,
      reason: 'nothing may reach the API before the admin confirms',
    );
  });

  testWidgets('cancelling the confirmation leaves the role alone', (
    tester,
  ) async {
    final repository = _SpyRepository();
    await _pumpSheet(tester, repository);

    await tester.tap(find.text('Gerente'));
    await tester.pump();
    await tester.tap(find.text('Salvar'));
    await tester.pump();
    await tester.tap(find.text('Cancelar'));
    await tester.pump();

    expect(repository.calls, 0);
  });

  testWidgets('confirming sends the change', (tester) async {
    final repository = _SpyRepository();
    await _pumpSheet(tester, repository);

    await tester.tap(find.text('Gerente'));
    await tester.pump();
    await tester.tap(find.text('Salvar'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('change-role-confirm')));
    await tester.pump();
    await tester.pump();

    expect(repository.calls, 1);
  });
}

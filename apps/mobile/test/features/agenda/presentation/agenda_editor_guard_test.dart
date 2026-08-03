import 'package:atlasmed_mobile_app/app.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

User _user(UserRoleName role) => User(
  id: 'user-1',
  email: 'user@atlasmed.test',
  username: 'user',
  firstName: 'Usuário',
  status: UserStatus.active,
  emailVerified: true,
  phoneVerified: true,
  twoFactorEnabled: false,
  role: UserRole(id: 'role', name: role),
  createdAt: DateTime(2026),
  updatedAt: DateTime(2026),
);

void main() {
  for (final role in [UserRoleName.manager, UserRoleName.ops]) {
    testWidgets('${role.name} cannot open calendar mutation route', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWith((ref) async => _user(role)),
          ],
          child: const MaterialApp(
            home: AgendaEditorRouteGuard(
              target: CalendarEditorTarget.creating(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Você não tem permissão para alterar a agenda.'),
        findsOneWidget,
      );
      expect(find.text('Novo compromisso'), findsNothing);
    });
  }
}

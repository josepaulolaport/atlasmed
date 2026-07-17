import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/mock_invitations_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late MockInvitationsRepository repository;

  setUp(() => repository = MockInvitationsRepository());

  test(
    'getInvitations returns the seeded invitations sorted by newest first',
    () async {
      final invitations = await repository.getInvitations();
      expect(invitations, isNotEmpty);
      for (var i = 1; i < invitations.length; i++) {
        expect(
          invitations[i - 1].createdAt.isAfter(invitations[i].createdAt) ||
              invitations[i - 1].createdAt.isAtSameMomentAs(
                invitations[i].createdAt,
              ),
          isTrue,
        );
      }
    },
  );

  test(
    'createInvitation adds a new pending invitation at the top of the list',
    () async {
      final created = await repository.createInvitation(
        email: 'novo.usuario@atlasmed.com.br',
        roleId: 'role-rep',
        managerId: 'user-fernanda-duarte',
        repTerritoryId: 'territory-zona-sul-onco',
      );

      expect(created.status, InvitationStatus.pending);
      expect(created.roleName, 'REP');
      expect(created.managerName, 'Fernanda Duarte');
      expect(created.territoryName, 'Zona Sul — Oncologia');

      final invitations = await repository.getInvitations();
      expect(invitations.first.id, created.id);
    },
  );

  test('resendInvitation increments the resend counter', () async {
    final before = (await repository.getInvitations()).first;
    await repository.resendInvitation(before.id);
    final after = (await repository.getInvitations()).firstWhere(
      (i) => i.id == before.id,
    );
    expect(after.resendCount, before.resendCount + 1);
  });

  test('revokeInvitation marks the invitation as revoked', () async {
    final before = (await repository.getInvitations()).first;
    await repository.revokeInvitation(before.id);
    final after = (await repository.getInvitations()).firstWhere(
      (i) => i.id == before.id,
    );
    expect(after.status, InvitationStatus.revoked);
  });
}

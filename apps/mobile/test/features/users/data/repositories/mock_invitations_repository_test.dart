import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
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
        firstName: 'Novo',
        lastName: 'Usuario',
        birthDate: DateTime(1994, 3, 21),
        phoneNumber: '+55 11 98888-0000',
        roleId: 'role-rep',
        sectorAssignments: const [
          InviteSectorAssignment(
            sectorId: 'sector-oncologia',
            sectorName: 'Oncologia',
            managerId: 'user-fernanda-duarte',
            managerName: 'Fernanda Duarte',
            territories: [],
          ),
        ],
      );

      expect(created.status, InvitationStatus.pending);
      expect(created.roleName, 'REP');
      expect(created.firstName, 'Novo');
      expect(created.lastName, 'Usuario');
      expect(created.phoneNumber, '+55 11 98888-0000');
      expect(created.managerName, 'Fernanda Duarte');

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

  test('getInvitation returns the full detail for a seeded invite', () async {
    final invitation = await repository.getInvitation('invite-1');
    expect(invitation.firstName, 'Rafael');
    expect(invitation.roleId, 'role-rep');
    expect(invitation.sectorAssignments, isNotEmpty);
    expect(invitation.sectorAssignments.first.territories, isNotEmpty);
  });

  test('updateInvitation changes pending invite fields', () async {
    final updated = await repository.updateInvitation(
      id: 'invite-1',
      email: 'rafael.mendes@atlasmed.com.br',
      firstName: 'Rafael',
      lastName: 'Mendes',
      birthDate: DateTime(1992, 4, 18),
      phoneNumber: '+55 11 90000-1111',
      roleId: 'role-rep',
      sectorAssignments: const [
        InviteSectorAssignment(
          sectorId: 'sector-oncologia',
          sectorName: 'Oncologia',
          managerId: 'user-fernanda-duarte',
          managerName: 'Fernanda Duarte',
          territories: [],
        ),
      ],
    );

    expect(updated.email, 'rafael.mendes@atlasmed.com.br');
    expect(updated.phoneNumber, '+55 11 90000-1111');
    expect(updated.status, InvitationStatus.pending);

    final fetched = await repository.getInvitation('invite-1');
    expect(fetched.email, 'rafael.mendes@atlasmed.com.br');
  });

  test('updateInvitation rejects non-pending invites', () async {
    expect(
      () => repository.updateInvitation(
        id: 'invite-5',
        email: 'aceito.recente@atlasmed.com.br',
        firstName: 'Pedro',
        lastName: 'Vasconcelos',
        birthDate: DateTime(1988, 6, 14),
        phoneNumber: '+55 11 94321-0987',
        roleId: 'role-rep',
      ),
      throwsStateError,
    );
  });
}

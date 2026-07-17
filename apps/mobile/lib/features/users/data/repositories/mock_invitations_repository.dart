import 'package:atlasmed_mobile_app/features/users/data/mock/mock_assignment_options_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_invitations_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_users_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/invitations_repository.dart';

/// In-memory [InvitationsRepository] backed by the static mock dataset.
class MockInvitationsRepository implements InvitationsRepository {
  final List<UserInvitation> _invitations = List<UserInvitation>.of(
    mockInvitations,
  );
  int _seq = mockInvitations.length + 1;

  Future<void> _delay([int ms = 300]) =>
      Future.delayed(Duration(milliseconds: ms));

  @override
  Future<List<UserInvitation>> getInvitations() async {
    await _delay(300);
    final sorted = List<UserInvitation>.of(_invitations)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sorted;
  }

  @override
  Future<UserInvitation> createInvitation({
    required String email,
    required String roleId,
    String? managerId,
    String? managerTerritoryId,
    String? repTerritoryId,
  }) async {
    await _delay(400);

    final role = mockRoles.firstWhere(
      (r) => r.id == roleId,
      orElse: () => mockRoles.last,
    );

    final managerName = managerId == null
        ? null
        : mockManagerOptions
              .firstWhere(
                (m) => m.id == managerId,
                orElse: () => const ManagerOption(id: '', name: '—'),
              )
              .name;

    final territoryId = managerTerritoryId ?? repTerritoryId;
    final territoryName = territoryId == null
        ? null
        : mockTerritoryOptions
              .firstWhere(
                (t) => t.id == territoryId,
                orElse: () => const TerritoryOption(id: '', name: '—'),
              )
              .name;

    final invitation = UserInvitation(
      id: 'invite-${_seq++}',
      email: email,
      roleName: role.name.name.toUpperCase(),
      status: InvitationStatus.pending,
      invitedByName: 'Você',
      managerName: managerName,
      territoryName: territoryName,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(days: 7)),
      resendCount: 0,
    );
    _invitations.insert(0, invitation);
    return invitation;
  }

  @override
  Future<void> resendInvitation(String id) async {
    await _delay();
    final index = _invitations.indexWhere((i) => i.id == id);
    if (index == -1) return;
    _invitations[index] = _invitations[index].copyWith(
      resendCount: _invitations[index].resendCount + 1,
    );
  }

  @override
  Future<void> revokeInvitation(String id) async {
    await _delay();
    final index = _invitations.indexWhere((i) => i.id == id);
    if (index == -1) return;
    _invitations[index] = _invitations[index].copyWith(
      status: InvitationStatus.revoked,
    );
  }
}

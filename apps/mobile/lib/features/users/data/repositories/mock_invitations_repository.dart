import 'package:atlasmed_mobile_app/features/users/data/mock/mock_invitations_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_users_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
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

  ({String? managerName, String? territoryName}) _summarize(
    List<InviteVerticalAssignment> verticalAssignments,
  ) {
    final first = verticalAssignments.isEmpty
        ? null
        : verticalAssignments.first;
    final managerName = first?.managerName;
    final String? territoryName;
    if (first == null) {
      territoryName = null;
    } else if (first.newPatch != null) {
      territoryName = first.newPatch!.name;
    } else if (first.territories.isEmpty) {
      territoryName = null;
    } else if (first.territories.length == 1) {
      territoryName = first.territories.first.name;
    } else {
      territoryName = '${first.territories.length} territórios';
    }
    return (managerName: managerName, territoryName: territoryName);
  }

  @override
  Future<List<UserInvitation>> getInvitations() async {
    await _delay(300);
    final sorted = List<UserInvitation>.of(_invitations)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sorted;
  }

  @override
  Future<UserInvitation> getInvitation(String id) async {
    await _delay(250);
    return _invitations.firstWhere(
      (i) => i.id == id,
      orElse: () => throw StateError('Invitation not found: $id'),
    );
  }

  @override
  Future<UserInvitation> createInvitation({
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteVerticalAssignment> verticalAssignments = const [],
  }) async {
    await _delay(400);

    final role = mockRoles.firstWhere(
      (r) => r.id == roleId,
      orElse: () => mockRoles.last,
    );
    final summary = _summarize(verticalAssignments);

    final invitation = UserInvitation(
      id: 'invite-${_seq++}',
      email: email,
      firstName: firstName,
      lastName: lastName,
      birthDate: birthDate,
      phoneNumber: phoneNumber,
      roleId: role.id,
      roleName: role.name.name.toUpperCase(),
      status: InvitationStatus.pending,
      invitedByName: 'Você',
      managerName: summary.managerName,
      territoryName: summary.territoryName,
      verticalAssignments: List<InviteVerticalAssignment>.of(
        verticalAssignments,
      ),
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(days: 7)),
      resendCount: 0,
    );
    _invitations.insert(0, invitation);
    return invitation;
  }

  @override
  Future<UserInvitation> updateInvitation({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteVerticalAssignment> verticalAssignments = const [],
  }) async {
    await _delay(400);

    final index = _invitations.indexWhere((i) => i.id == id);
    if (index == -1) {
      throw StateError('Invitation not found: $id');
    }
    final existing = _invitations[index];
    if (!existing.status.isEditable) {
      throw StateError('Invitation is not editable: $id');
    }

    final role = mockRoles.firstWhere(
      (r) => r.id == roleId,
      orElse: () => mockRoles.last,
    );
    final summary = _summarize(verticalAssignments);

    final updated = existing.copyWith(
      email: email,
      firstName: firstName,
      lastName: lastName,
      birthDate: birthDate,
      phoneNumber: phoneNumber,
      roleId: role.id,
      roleName: role.name.name.toUpperCase(),
      managerName: summary.managerName,
      territoryName: summary.territoryName,
      clearManagerName: summary.managerName == null,
      clearTerritoryName: summary.territoryName == null,
      verticalAssignments: List<InviteVerticalAssignment>.of(
        verticalAssignments,
      ),
    );
    _invitations[index] = updated;
    return updated;
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

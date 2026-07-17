import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';

/// Port for the invite-flow data source. Method signatures mirror the real
/// endpoints (`POST /access/invite`, `GET /access/invitations`,
/// `DELETE /access/invites/:id`, `POST /access/invites/:id/resend`) so a
/// future HTTP-backed implementation is a drop-in replacement for
/// [MockInvitationsRepository].
abstract interface class InvitationsRepository {
  /// `GET /access/invitations`
  Future<List<UserInvitation>> getInvitations();

  /// `POST /access/invite`
  Future<UserInvitation> createInvitation({
    required String email,
    required String roleId,
    String? managerId,
    String? managerTerritoryId,
    String? repTerritoryId,
  });

  /// `POST /access/invites/:id/resend`
  Future<void> resendInvitation(String id);

  /// `DELETE /access/invites/:id`
  Future<void> revokeInvitation(String id);
}

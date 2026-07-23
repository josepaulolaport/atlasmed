import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';

/// Port for the invite-flow data source. Method signatures mirror the real
/// endpoints (`POST /access/invite`, `GET /access/invitations`,
/// `GET /access/invitations/:id`, `PATCH /access/invites/:id`,
/// `DELETE /access/invites/:id`, `POST /access/invites/:id/resend`) so a
/// future HTTP-backed implementation is a drop-in replacement for
/// [MockInvitationsRepository].
abstract interface class InvitationsRepository {
  /// `GET /access/invitations`
  Future<List<UserInvitation>> getInvitations();

  /// `GET /access/invitations/:id`
  Future<UserInvitation> getInvitation(String id);

  /// `POST /access/invite`
  ///
  /// [sectorAssignments] carries per-sector manager + territory picks for
  /// non-admin roles (REP needs a manager and ≥1 territory per sector;
  /// Manager needs ≥1 territory per sector).
  Future<UserInvitation> createInvitation({
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteSectorAssignment> sectorAssignments = const [],
  });

  /// `PATCH /access/invites/:id` — only valid while status is pending.
  Future<UserInvitation> updateInvitation({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteSectorAssignment> sectorAssignments = const [],
  });

  /// `POST /access/invites/:id/resend`
  Future<void> resendInvitation(String id);

  /// `DELETE /access/invites/:id`
  Future<void> revokeInvitation(String id);
}

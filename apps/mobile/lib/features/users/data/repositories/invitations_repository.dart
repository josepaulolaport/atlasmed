import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';

/// Port for the invite-flow data source. Method signatures mirror the real
/// endpoints (`POST /access/invite`, `GET /access/invitations`,
/// `GET /access/invitations/:id`, `PATCH /access/invites/:id`,
/// `DELETE /access/invites/:id`, `POST /access/invites/:id/resend`).
abstract interface class InvitationsRepository {
  /// `GET /access/invitations`
  Future<List<UserInvitation>> getInvitations();

  /// `GET /access/invitations/:id`
  Future<UserInvitation> getInvitation(int id);

  /// `POST /access/invite`
  ///
  /// [verticalAssignments] carries per-sector manager + territory picks for
  /// non-admin roles (REP needs a manager and ≥1 territory per sector;
  /// Manager needs ≥1 territory per sector).
  Future<UserInvitation> createInvitation({
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required int roleId,
    List<InviteVerticalAssignment> verticalAssignments = const [],
  });

  /// `PATCH /access/invites/:id` — only valid while status is pending.
  Future<UserInvitation> updateInvitation({
    required int id,
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required int roleId,
    List<InviteVerticalAssignment> verticalAssignments = const [],
  });

  /// `POST /access/invites/:id/resend`
  Future<void> resendInvitation(int id);

  /// `DELETE /access/invites/:id`
  Future<void> revokeInvitation(int id);
}

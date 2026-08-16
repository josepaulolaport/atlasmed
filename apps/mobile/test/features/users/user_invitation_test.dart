import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/invite_action_message.dart';
import 'package:flutter_test/flutter_test.dart';

UserInvitation _invitation({
  String email = 'adriana@empresa.com.br',
  String? firstName,
  String? lastName,
  String? phoneNumber,
  String roleName = 'REP',
  InvitationStatus status = InvitationStatus.pending,
  Duration expiresIn = const Duration(days: 3),
}) => UserInvitation(
  id: 12,
  email: email,
  roleName: roleName,
  status: status,
  invitedByName: 'Marcos Vieira',
  firstName: firstName,
  lastName: lastName,
  phoneNumber: phoneNumber,
  createdAt: DateTime.now().subtract(const Duration(days: 4)),
  expiresAt: DateTime.now().add(expiresIn),
  resendCount: 0,
);

void main() {
  group('effectiveStatus', () {
    test('a pending invite past its expiry reads as expired', () {
      final invite = _invitation(expiresIn: const Duration(hours: -1));

      expect(invite.status, InvitationStatus.pending);
      expect(invite.effectiveStatus, InvitationStatus.expired);
      expect(invite.effectiveStatus.isEditable, isFalse);
    });

    test('a pending invite still in date stays pending', () {
      expect(_invitation().effectiveStatus, InvitationStatus.pending);
    });

    test('an accepted invite is never reclassified by the clock', () {
      final invite = _invitation(
        status: InvitationStatus.accepted,
        expiresIn: const Duration(days: -30),
      );

      expect(invite.effectiveStatus, InvitationStatus.accepted);
    });
  });

  group('roleLabel', () {
    test('maps the wire enum to the name people use', () {
      expect(_invitation(roleName: 'REP').roleLabel, 'Representante');
      expect(_invitation(roleName: 'MANAGER').roleLabel, 'Gerente');
    });

    test('falls back to the raw value for a role it does not know', () {
      expect(_invitation(roleName: 'AUDITOR').roleLabel, 'AUDITOR');
    });
  });

  group('displayName', () {
    test('prefers the name', () {
      expect(
        _invitation(firstName: 'Adriana', lastName: 'Oliveira').displayName,
        'Adriana Oliveira',
      );
    });

    test('falls back to the phone when the invite went out without an '
        'email', () {
      expect(
        _invitation(email: '', phoneNumber: '+55 11 99999-0000').displayName,
        '+55 11 99999-0000',
      );
    });

    test('never renders blank', () {
      expect(_invitation(email: '').displayName, 'Convite #12');
    });
  });

  group('describeInviteActionError', () {
    UsersApiException error(int statusCode, String message) =>
        UsersApiException(
          statusCode: statusCode,
          code: statusCode == 429
              ? 'RATE_LIMIT_EXCEEDED'
              : 'OPERATION_NOT_ALLOWED',
          message: message,
        );

    test('names the cooldown', () {
      expect(
        describeInviteActionError(error(429, 'Too many requests.')),
        contains('Aguarde'),
      );
    });

    test('tells the admin to send a new invite when this one expired', () {
      expect(
        describeInviteActionError(
          error(422, 'Operation not allowed: Invitation has expired'),
        ),
        contains('expirou'),
      );
    });

    test('tells the admin the resend cap was hit', () {
      expect(
        describeInviteActionError(
          error(422, 'Operation not allowed: Maximum resend limit (3) reached'),
        ),
        contains('limite de reenvios'),
      );
    });

    test('falls back for anything it cannot explain', () {
      expect(
        describeInviteActionError(Exception('socket closed')),
        'Não foi possível concluir a ação.',
      );
    });
  });
}

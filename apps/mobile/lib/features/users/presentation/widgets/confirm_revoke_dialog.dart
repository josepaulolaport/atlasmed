import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Asks before revoking an invitation.
///
/// Revoking was one tap on a popup-menu row, in both the invitations list and
/// the invitation detail — no confirmation on an action that cannot be undone
/// and that the invitee cannot recover from: their link stops working, and
/// somebody has to invite them again from scratch.
///
/// Shared so the two call sites cannot drift apart on the wording.
Future<bool> confirmRevokeInvitation(
  BuildContext context, {
  required String inviteeName,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text('Revogar o convite de $inviteeName?'),
      content: const Text(
        'O link enviado deixa de funcionar. Para convidar esta pessoa de '
        'novo será preciso começar um convite do zero.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          key: const Key('invitation-revoke-confirm'),
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: TextButton.styleFrom(foregroundColor: AppColors.red),
          child: const Text('Revogar'),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

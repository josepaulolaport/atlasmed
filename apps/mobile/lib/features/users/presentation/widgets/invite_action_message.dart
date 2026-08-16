import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';

/// Turns a failed resend/revoke into something the admin can act on.
///
/// Both call sites caught everything and said "Não foi possível concluir a
/// ação." — but the API rejects a resend for four different reasons, three of
/// which the admin can do something about: the invite expired (create a new
/// one), the resend cap is reached (create a new one), or the cooldown has not
/// elapsed (wait). Told only that it failed, they just tap again.
String describeInviteActionError(Object error) {
  if (error is! UsersApiException) {
    return 'Não foi possível concluir a ação.';
  }

  if (error.statusCode == 429) {
    return 'Este convite foi reenviado há pouco. Aguarde alguns minutos e '
        'tente de novo.';
  }

  // 422 OPERATION_NOT_ALLOWED carries an English reason from the use case.
  // Match on it rather than show it, so the admin reads Portuguese.
  final reason = error.message.toLowerCase();
  if (error.statusCode == 422) {
    if (reason.contains('expired')) {
      return 'Este convite expirou. Envie um convite novo.';
    }
    if (reason.contains('maximum resend')) {
      return 'Este convite atingiu o limite de reenvios. Envie um convite '
          'novo.';
    }
    if (reason.contains('only pending')) {
      return 'Este convite não está mais pendente.';
    }
  }

  if (error.statusCode == 403) {
    return 'Você não pode alterar um convite enviado por outra pessoa.';
  }
  if (error.statusCode == 404) {
    return 'Este convite não existe mais.';
  }

  return 'Não foi possível concluir a ação.';
}

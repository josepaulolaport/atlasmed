/// Turns a territory save failure into Portuguese.
///
/// The editor showed `TerritoryApiException.message` verbatim, and the API
/// writes those in English — "This territory type must be a single connected
/// polygon; merge or remove disconnected areas before saving" is the one a
/// manager hits most, right after drawing a second detached area. Showing the
/// server's sentence also leaked the operation name it prefixes them with.
String describeTerritorySaveError({
  required int statusCode,
  required String message,
}) {
  final reason = message.toLowerCase();

  if (reason.contains('single connected polygon')) {
    return 'Este tipo de território precisa ser uma área única e contínua. '
        'Junte as partes separadas ou remova as que sobraram.';
  }
  if (reason.contains('coordinates cannot be empty') ||
      reason.contains('invalid geometry')) {
    return 'O contorno desenhado é inválido. Refaça a área e tente de novo.';
  }
  if (reason.contains('must keep a geographic boundary')) {
    return 'Este tipo de território não pode ficar sem contorno.';
  }
  if (reason.contains('cannot have a boundary')) {
    return 'Este tipo de território não aceita contorno.';
  }
  if (reason.contains('not active')) {
    return 'Este território está inativo e não pode ser editado.';
  }
  if (reason.contains('only admins')) {
    return 'Só um administrador pode editar o contorno de uma zona de '
        'gerente.';
  }
  if (statusCode == 403) {
    return 'Você não tem permissão para editar este território.';
  }
  if (statusCode == 404) {
    return 'Este território não existe mais.';
  }

  return 'Não foi possível salvar. Tente novamente.';
}

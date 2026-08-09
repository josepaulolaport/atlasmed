import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';

/// Maps pt-BR admin field labels (and a few aliases) to API `fieldKey`s.
String? fieldKeyForLabel(String label) {
  switch (label.trim().toLowerCase()) {
    case 'nome':
      return 'displayName';
    case 'telefone':
      return 'phoneNumber';
    case 'whatsapp':
      return 'whatsappNumber';
    case 'e-mail':
    case 'email':
      return 'email';
    case 'site':
      return 'websiteUrl';
    case 'responsável':
    case 'responsavel':
      return 'responsibleName';
    case 'horário':
    case 'horario':
    case 'horário de funcionamento':
      return 'openingHours';
    case 'cnpj':
    case 'cpf':
    case 'documento':
    case 'documento legal':
      return 'legalDocument';
    case 'tipo':
    case 'tipo do estabelecimento':
      return 'legalDocumentType';
    case 'endereço':
    case 'endereco':
      return 'address';
    default:
      return null;
  }
}

NaoConformidadeSuggestion suggestionFromApi(Map<String, dynamic> map) {
  final kindRaw = map['kind'] as String? ?? 'FIELD_CHANGE';
  final statusRaw = map['status'] as String? ?? 'PENDING';
  final roleRaw = (map['submittedByRole'] as String? ?? 'REP').toUpperCase();

  return NaoConformidadeSuggestion(
    id: readCrmId(map['id'], 'id'),
    kind: kindRaw == 'DEACTIVATION'
        ? NaoConformidadeKind.deactivation
        : NaoConformidadeKind.fieldChange,
    targetType: NaoConformidadeTargetType.clinic,
    targetId: readCrmId(map['facilityId'], 'facilityId'),
    targetName: map['facilityName'] as String? ?? '',
    fieldLabel: map['fieldLabel'] as String? ?? 'Campo',
    currentValue: formatSuggestionValue(map['currentValue']),
    suggestedValue: formatSuggestionValue(map['proposedValue']),
    reason: map['reason'] as String?,
    submittedByUserId: readCrmIdOrNull(
      map['submittedByUserId'],
      'submittedByUserId',
    ),
    submittedByName: map['submittedByName'] as String? ?? 'Usuário',
    submittedByRole: roleRaw.contains('MANAGER')
        ? NaoConformidadeSubmitterRole.manager
        : NaoConformidadeSubmitterRole.rep,
    submittedAt: DateTime.parse(map['submittedAt'] as String),
    status: switch (statusRaw) {
      'APPROVED' => NaoConformidadeStatus.accepted,
      'REJECTED' => NaoConformidadeStatus.rejected,
      _ => NaoConformidadeStatus.pending,
    },
    reviewerNote: map['resolutionNote'] as String?,
    reviewedAt: map['resolvedAt'] != null
        ? DateTime.tryParse(map['resolvedAt'] as String)
        : null,
    reviewedByName: map['resolvedByName'] as String?,
  );
}

String formatSuggestionValue(Object? value) {
  if (value == null) return '—';
  if (value is String) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? '—' : trimmed;
  }
  if (value is num || value is bool) return value.toString();
  if (value is Map) {
    final map = value.map((k, v) => MapEntry(k.toString(), v));
    if (map.containsKey('deactivate')) {
      return 'Desativar estabelecimento';
    }
    if (map.containsKey('streetAddress') ||
        map.containsKey('neighborhood') ||
        map.containsKey('city')) {
      return _formatAddress(map);
    }
    return jsonEncode(map);
  }
  if (value is List) {
    return value.map(formatSuggestionValue).join(', ');
  }
  return value.toString();
}

String _formatAddress(Map<String, dynamic> map) {
  String? part(String key) {
    final v = map[key];
    if (v is! String) return null;
    final t = v.trim();
    return t.isEmpty ? null : t;
  }

  final street = [
    part('streetAddress'),
    part('streetNumber'),
  ].whereType<String>().join(', ');
  final withComplement = [
    if (street.isNotEmpty) street,
    part('addressComplement'),
  ].whereType<String>().join(' - ');
  final cityState = [
    part('city'),
    part('state'),
  ].whereType<String>().join(' - ');

  final segments = [
    if (withComplement.isNotEmpty) withComplement,
    part('neighborhood'),
    if (cityState.isNotEmpty) cityState,
    part('postalCode'),
  ].whereType<String>();

  final joined = segments.join(', ');
  return joined.isEmpty ? '—' : joined;
}

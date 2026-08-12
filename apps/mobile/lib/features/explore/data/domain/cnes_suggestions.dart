import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';

/// Why the CNES section has nothing to show.
///
/// Kept as distinct cases rather than collapsed into "empty" because they call
/// for different words on screen: a clinic with no CNES code is a data-entry
/// gap someone can fix, an unloaded registry is an ops problem, and a genuinely
/// empty result means CNES simply knows nobody here we do not already have.
enum CnesSuggestionsStatus {
  ok,
  facilityWithoutCnesCode,
  facilityNotInRegistry,
  registryEmpty,

  /// The request itself failed. Distinct from every server-reported case: the
  /// section should say so rather than imply CNES had no answer.
  unavailable;

  static CnesSuggestionsStatus parse(String? raw) {
    switch (raw) {
      case 'OK':
        return CnesSuggestionsStatus.ok;
      case 'FACILITY_WITHOUT_CNES_CODE':
        return CnesSuggestionsStatus.facilityWithoutCnesCode;
      case 'FACILITY_NOT_IN_REGISTRY':
        return CnesSuggestionsStatus.facilityNotInRegistry;
      case 'REGISTRY_EMPTY':
        return CnesSuggestionsStatus.registryEmpty;
      default:
        return CnesSuggestionsStatus.unavailable;
    }
  }
}

/// One professional CNES links to this clinic.
class CnesSuggestion {
  const CnesSuggestion({
    required this.personId,
    required this.displayName,
    this.occupation,
    this.registrationLabel,
  });

  final int personId;
  final String displayName;

  /// e.g. `MEDICO ORTOPEDISTA E TRAUMATOLOGISTA` — what makes a suggestion
  /// useful rather than a bare name (spec 0012 §3.1).
  final String? occupation;

  /// e.g. `CRM 119508/SP`.
  final String? registrationLabel;

  /// Returns null for a row it cannot make sense of, rather than throwing.
  ///
  /// One unparseable row used to take the whole section down: the cast threw,
  /// the fetch's catch turned it into "não foi possível consultar", and a
  /// serialisation bug was indistinguishable from CNES being unreachable.
  static CnesSuggestion? tryFromMap(Map<String, dynamic> map) {
    final personId = _asInt(map['personId']);
    if (personId == null) return null;
    return CnesSuggestion(
      personId: personId,
      displayName: (map['displayName'] as String?)?.trim().isNotEmpty == true
          ? map['displayName'] as String
          : 'Sem nome',
      occupation: _nonEmpty(map['occupation']),
      registrationLabel: _nonEmpty(map['registrationLabel']),
    );
  }

  /// The same shape the rest of the sheet renders, so a CNES row and a row from
  /// our own data are drawn by one widget rather than two that drift apart.
  ProfessionalRoster toRoster() {
    return ProfessionalRoster(
      id: personId,
      name: displayName,
      initials: initialsFromName(displayName),
      hue: hueFromName(displayName),
      specialty: occupation,
      crm: registrationLabel,
    );
  }
}

/// `persons.id` is a bigint, which JSON encoders may render as a number or a
/// string depending on the driver. Accept both.
int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value.trim());
  return null;
}

String? _nonEmpty(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

class CnesSuggestions {
  const CnesSuggestions({
    required this.status,
    required this.items,
    this.reference,
  });

  final CnesSuggestionsStatus status;
  final List<CnesSuggestion> items;

  /// Competence of the loaded snapshot, `YYYY-MM`. Shown so a rep can tell how
  /// old the claim is — the risk ADR 0006 accepted while this was unavailable.
  final String? reference;

  factory CnesSuggestions.unavailable() => const CnesSuggestions(
    status: CnesSuggestionsStatus.unavailable,
    items: [],
  );

  factory CnesSuggestions.fromMap(Map<String, dynamic> map) {
    final rawItems = map['items'];
    return CnesSuggestions(
      status: CnesSuggestionsStatus.parse(map['status'] as String?),
      reference: _nonEmpty(map['reference']),
      items: rawItems is List
          ? rawItems
                .whereType<Map<String, dynamic>>()
                .map(CnesSuggestion.tryFromMap)
                .whereType<CnesSuggestion>()
                .toList(growable: false)
          : const [],
    );
  }

  bool get hasItems => items.isNotEmpty;

  static const _months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  /// `segundo o CNES em maio de 2026`, or null when no snapshot is loaded.
  String? get referenceLabel {
    final raw = reference;
    if (raw == null) return null;
    final parts = raw.split('-');
    if (parts.length != 2) return null;
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    if (year == null || month == null || month < 1 || month > 12) return null;
    return 'segundo o CNES em ${_months[month - 1]} de $year';
  }

  /// What the section says when it has nothing to list.
  String get emptyMessage {
    switch (status) {
      case CnesSuggestionsStatus.facilityWithoutCnesCode:
        return 'Esta clínica não tem código CNES cadastrado, '
            'então não é possível buscar profissionais vinculados.';
      case CnesSuggestionsStatus.facilityNotInRegistry:
        return 'O CNES não reconhece o código desta clínica. '
            'Verifique se o código CNES está correto.';
      case CnesSuggestionsStatus.registryEmpty:
        return 'Os dados do CNES ainda não foram carregados.';
      case CnesSuggestionsStatus.unavailable:
        return 'Não foi possível consultar o CNES agora.';
      case CnesSuggestionsStatus.ok:
        return 'O CNES não indica outros profissionais nesta clínica.';
    }
  }
}

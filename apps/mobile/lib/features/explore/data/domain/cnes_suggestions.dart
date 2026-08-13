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

/// One occupation an import can save, as our catalogue names it.
class CnesOccupationOption {
  const CnesOccupationOption({required this.id, required this.name});

  final int id;
  final String name;

  static CnesOccupationOption? tryFromMap(Object? raw) {
    if (raw is! Map) return null;
    final id = _asInt(raw['id']);
    final name = _nonEmpty(raw['name']);
    if (id == null || name == null) return null;
    return CnesOccupationOption(id: id, name: name);
  }
}

/// One professional CNES links to this clinic.
class CnesSuggestion {
  const CnesSuggestion({
    required this.personId,
    required this.professionalCnesId,
    required this.displayName,
    this.occupation,
    this.occupationOptions = const [],
    this.registrationLabel,
    this.alreadyLinked = false,
  });

  /// What CNES records them doing here, in the form an import can save.
  ///
  /// Preselected rather than asked for: CNES already states it, and a rep who
  /// disagrees unticks. A CBO our catalogue does not carry shows in
  /// [occupation] but is absent here — displayable, not saveable.
  final List<CnesOccupationOption> occupationOptions;

  /// Null when we do not hold this person under any identity.
  ///
  /// CNES places ~18 000 people at our clinics whom our database has never
  /// heard of. They are shown flagged rather than hidden, because a rep cannot
  /// import somebody the list never displayed — and importing is the only way
  /// they enter our database at all.
  final int? personId;

  /// `CO_PROFISSIONAL_SUS` — what an import names, since there may be no person.
  final String professionalCnesId;
  final String displayName;

  /// We already hold this person; the rep associates rather than imports.
  bool get isKnown => personId != null;

  /// e.g. `MEDICO ORTOPEDISTA E TRAUMATOLOGISTA` — what makes a suggestion
  /// useful rather than a bare name (spec 0012 §3.1).
  final String? occupation;

  /// e.g. `CRM 119508/SP`.
  final String? registrationLabel;

  /// Already linked at this clinic as a clinician, per the server.
  ///
  /// Shown in its own section on the CNES tab rather than hidden, so the tab
  /// answers "of the people CNES places here, which do we already have" — which
  /// is about this snapshot, not about our roster in general.
  final bool alreadyLinked;

  /// Returns null for a row it cannot make sense of, rather than throwing.
  ///
  /// One unparseable row used to take the whole section down: the cast threw,
  /// the fetch's catch turned it into "não foi possível consultar", and a
  /// serialisation bug was indistinguishable from CNES being unreachable.
  static CnesSuggestion? tryFromMap(Map<String, dynamic> map) {
    // `professionalCnesId` is the identity every row has; `personId` is the one
    // only some rows have. Keying the guard on the wrong one is what used to
    // drop the entire unmatched population on the floor.
    final professionalCnesId = _nonEmpty(map['professionalCnesId']);
    if (professionalCnesId == null) return null;
    return CnesSuggestion(
      personId: _asInt(map['personId']),
      professionalCnesId: professionalCnesId,
      displayName: (map['displayName'] as String?)?.trim().isNotEmpty == true
          ? map['displayName'] as String
          : 'Sem nome',
      occupation: _nonEmpty(map['occupation']),
      occupationOptions: map['occupationOptions'] is List
          ? (map['occupationOptions'] as List)
                .map(CnesOccupationOption.tryFromMap)
                .whereType<CnesOccupationOption>()
                .toList(growable: false)
          : const [],
      registrationLabel: _nonEmpty(map['registrationLabel']),
      alreadyLinked: map['alreadyLinked'] == true,
    );
  }

  /// The same shape the rest of the sheet renders, so a CNES row and a row from
  /// our own data are drawn by one widget rather than two that drift apart.
  ///
  /// [id] is required for selection, and someone we do not hold has no person
  /// id yet — so [importedAs] carries the id the import just minted. Calling
  /// this on an unknown person without one is a bug, not a rendering case.
  ProfessionalRoster toRoster({int? importedAs}) {
    return ProfessionalRoster(
      id: importedAs ?? personId!,
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

  /// CNES places them here, we hold them, and they are not linked yet — one tap.
  List<CnesSuggestion> get unlinked =>
      items.where((i) => !i.alreadyLinked && i.isKnown).toList(growable: false);

  /// CNES places them here and we do not hold them — these must be imported.
  List<CnesSuggestion> get unknown =>
      items.where((i) => !i.isKnown).toList(growable: false);

  /// CNES places them here and we already have them linked.
  List<CnesSuggestion> get linked =>
      items.where((i) => i.alreadyLinked).toList(growable: false);

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

  /// `maio/2026`, or null when no snapshot is loaded.
  ///
  /// Short because it rides on the section header rather than standing as its
  /// own line — a rep needs to know which month they are looking at, not a
  /// sentence about it.
  String? get referenceShort {
    final raw = reference;
    if (raw == null) return null;
    final parts = raw.split('-');
    if (parts.length != 2) return null;
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    if (year == null || month == null || month < 1 || month > 12) return null;
    return '${_months[month - 1]}/$year';
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

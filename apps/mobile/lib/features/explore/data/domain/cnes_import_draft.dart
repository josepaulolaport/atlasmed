import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';

/// A registration the rep typed, on top of the one CNES supplied.
///
/// Additive by construction: there is no field here for the CNES registration
/// itself, and the server would refuse it anyway. A doctor legitimately holding
/// a second council or a second state is a different claim from correcting the
/// one the whole feature resolves them by.
class DraftRegistration {
  const DraftRegistration({
    required this.councilId,
    required this.councilAbbreviation,
    required this.stateCode,
    required this.registrationNumber,
  });

  final int councilId;
  final String councilAbbreviation;
  final String stateCode;
  final String registrationNumber;

  String get label => '$councilAbbreviation $registrationNumber/$stateCode';

  Map<String, dynamic> toJson() => {
    'councilId': councilId,
    'stateCode': stateCode,
    'registrationNumber': registrationNumber,
  };
}

/// Everything the wizard collects about one doctor before importing them.
///
/// Mutable and owned by the wizard rather than rebuilt per step: the rep moves
/// back and forth between steps, and a draft that re-derived itself from CNES on
/// every build would quietly undo their edits.
class CnesImportDraft {
  CnesImportDraft({
    required this.suggestion,
    required this.firstName,
    required this.lastName,
    required this.occupationIds,
  });

  /// Prefilled from CNES, which ships one `full_name` field.
  ///
  /// Splits on the last space, the same default the server applies when the
  /// client sends nothing. Portuguese surnames are routinely compound, so both
  /// halves stay editable — this is a starting point, not a rule.
  factory CnesImportDraft.fromSuggestion(CnesSuggestion suggestion) {
    final parts = suggestion.displayName
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    final firstName = parts.length > 1
        ? parts.sublist(0, parts.length - 1).join(' ')
        : (parts.isEmpty ? '' : parts.first);
    final lastName = parts.isEmpty ? '' : parts.last;
    return CnesImportDraft(
      suggestion: suggestion,
      firstName: firstName,
      lastName: lastName,
      // Everything CNES records starts ticked: the rep is confirming a claim
      // that already exists, and unticking is cheaper than picking from 66.
      occupationIds: suggestion.occupationOptions
          .map((o) => o.id)
          .toList(growable: true),
    );
  }

  final CnesSuggestion suggestion;

  String firstName;
  String lastName;
  String? socialName;
  String? cpf;
  String? birthDate;
  String? email;
  String? mobilePhone;
  String? landlinePhone;

  /// Required before the wizard will import. 1 205 of the 1 206 doctors we hold
  /// carry one, so this makes explicit what the data already says.
  int? specialtyId;

  /// Optional. A role says what someone is *to this clinic* rather than who
  /// they are, and not every person at a clinic has one.
  final Set<int> roleIds = {};

  /// Order matters: the first is written as primary.
  List<int> occupationIds;

  final List<DraftRegistration> extraRegistrations = [];

  String? hobbies;
  String? favoriteTeam;
  String? favoriteSport;
  String? languages;

  /// What CNES gives us, shown read-only. Null only if the export carried none,
  /// in which case the server refuses the import outright.
  String? get sourcedRegistrationLabel => suggestion.registrationLabel;

  bool get hasName => firstName.trim().isNotEmpty && lastName.trim().isNotEmpty;

  /// Null when the field is acceptable — empty counts, since both are optional.
  ///
  /// These two are checked here rather than left to the server because the
  /// columns behind them are `char(11)` and `date`: anything else comes back as
  /// a rejected request after the rep has finished the whole wizard, naming a
  /// field they can no longer see.
  String? get cpfError {
    final value = cpf?.trim() ?? '';
    if (value.isEmpty) return null;
    return RegExp(r'^\d{11}$').hasMatch(value)
        ? null
        : 'CPF deve ter 11 dígitos';
  }

  String? get birthDateError {
    final value = birthDate?.trim() ?? '';
    if (value.isEmpty) return null;
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
      return 'Use o formato AAAA-MM-DD';
    }
    // Shape alone would accept 2026-02-30. Reparsing and comparing back is what
    // separates a date from eleven plausible characters.
    final parsed = DateTime.tryParse('${value}T00:00:00Z');
    if (parsed == null) return 'Data inválida';
    final normalised = parsed.toUtc().toIso8601String().substring(0, 10);
    return normalised == value ? null : 'Data inválida';
  }

  /// The only gate between the steps. Everything else is optional on purpose:
  /// of the 1 206 doctors we hold, 37 carry a mobile number and none a birth
  /// date, so requiring more would block imports on data nobody has.
  ///
  /// Specialty alone: 1 205 of 1 206 carry one and a doctor without it is
  /// unfindable by the search reps use, whereas a role is a fact about this
  /// clinic that a rep may legitimately not have.
  bool get isClinicalComplete => specialtyId != null;

  bool get isIdentityComplete => hasName && cpfError == null;

  bool get isReadyToImport =>
      isIdentityComplete && isClinicalComplete && birthDateError == null;

  String get displayName => '${firstName.trim()} ${lastName.trim()}'.trim();

  /// The import payload. Blank optional fields are omitted rather than sent as
  /// empty strings — `null` means "unknown", `''` would mean "known to be
  /// nothing", and the second is a claim nobody made.
  Map<String, dynamic> toImportBody() {
    String? trimmed(String? value) {
      final v = value?.trim();
      return (v == null || v.isEmpty) ? null : v;
    }

    return {
      'professionalCnesId': suggestion.professionalCnesId,
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      'specialtyId': specialtyId,
      // Sent even when empty, so the shape is the same whether or not the rep
      // had an answer.
      'roleIds': roleIds.toList()..sort(),
      // Always sent: `[]` means the rep cleared them, which differs from
      // omitting the field and inheriting CNES's list.
      'occupationIds': occupationIds,
      if (trimmed(socialName) != null) 'socialName': trimmed(socialName),
      if (trimmed(cpf) != null) 'cpf': trimmed(cpf),
      if (trimmed(birthDate) != null) 'birthDate': trimmed(birthDate),
      if (trimmed(email) != null) 'email': trimmed(email),
      if (trimmed(mobilePhone) != null) 'mobilePhone': trimmed(mobilePhone),
      if (trimmed(landlinePhone) != null)
        'landlinePhone': trimmed(landlinePhone),
      if (extraRegistrations.isNotEmpty)
        'extraRegistrations': extraRegistrations
            .map((r) => r.toJson())
            .toList(growable: false),
      if (trimmed(hobbies) != null) 'hobbies': trimmed(hobbies),
      if (trimmed(favoriteTeam) != null) 'favoriteTeam': trimmed(favoriteTeam),
      if (trimmed(favoriteSport) != null)
        'favoriteSport': trimmed(favoriteSport),
      if (trimmed(languages) != null) 'languages': trimmed(languages),
    };
  }
}

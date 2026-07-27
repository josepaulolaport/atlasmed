import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';

/// Confirmed CRM doctor at a facility (roster context).
///
/// Maps from [FacilityProfessionalItemDTO] — the facility-scoped
/// professional association API response.
class ProfessionalRoster {
  const ProfessionalRoster({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    this.specialty,
    this.crm,
    this.phone,
    this.email,
    this.isPartner = false,
    this.isPrescriber = false,
    this.isBuyer = false,
    this.isDecisionMaker = false,
    this.roleBadge,
    this.education,
    this.birthdayLabel,
    this.favoriteTeam,
    this.interests,
    this.noteText,
    this.relationshipScore,
  });

  final String id;
  final String name;
  final String initials;
  final double hue;
  final String? specialty;
  final String? crm;

  /// Essential contact fields — mirrors `professionals.phone`/`email`.
  final String? phone;
  final String? email;

  /// Facility-association role flags (`facility_professionals`).
  final bool isPartner;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;

  /// Small highlight badge, e.g. "DECISORA", "NOVA".
  final String? roleBadge;

  /// "Formação" — no backing field on `professionals` yet.
  final String? education;

  /// "Aniversário" — mirrors `professionals.birthDate` once wired.
  final String? birthdayLabel;

  /// "Time" — mirrors `professionals.favoriteTeam` once wired.
  final String? favoriteTeam;

  /// "Interesses" — mirrors `professionals.hobbies` once wired.
  final String? interests;

  /// Most recent note from `professional_notes`, shown as an amber chip.
  final String? noteText;

  /// Authenticated user's relationship with this professional (1–10),
  /// from `user_professional_relationships`. Null = not yet assessed.
  /// Drives Relacionamento stars in the UI.
  final int? relationshipScore;

  factory ProfessionalRoster.fromRosterItem(FacilityProfessionalItemDTO item) {
    final professional = item.professional;
    final association = item.association;
    final name = professional.fullName?.trim().isNotEmpty == true
        ? professional.fullName!.trim()
        : '${professional.firstName} ${professional.lastName}'.trim();
    final phone = professional.mobilePhone?.trim().isNotEmpty == true
        ? professional.mobilePhone
        : professional.landlinePhone;
    final crm = _formatCrm(professional.crmNumber, professional.crmState);
    return ProfessionalRoster(
      id: professional.id,
      name: name,
      initials: initialsFromName(name),
      hue: hueFromName(name),
      specialty: professional.specialty ?? association.specialtyLabel,
      crm: crm,
      phone: phone,
      email: professional.email,
      isPartner: association.isPartner,
      isPrescriber: association.isPrescriber,
      isBuyer: association.isBuyer,
      isDecisionMaker: association.isDecisionMaker,
      roleBadge: association.isDecisionMaker ? 'DECISOR' : null,
      birthdayLabel: _formatBirthday(professional.birthDate),
      favoriteTeam: professional.favoriteTeam,
      interests: professional.hobbies,
      relationshipScore: association.relationshipLevel,
    );
  }

  ProfessionalRoster copyWith({
    String? id,
    String? name,
    String? initials,
    double? hue,
    String? specialty,
    String? crm,
    String? phone,
    String? email,
    bool? isPartner,
    bool? isPrescriber,
    bool? isBuyer,
    bool? isDecisionMaker,
    String? roleBadge,
    bool clearRoleBadge = false,
    String? education,
    String? birthdayLabel,
    String? favoriteTeam,
    String? interests,
    String? noteText,
    int? relationshipScore,
  }) {
    return ProfessionalRoster(
      id: id ?? this.id,
      name: name ?? this.name,
      initials: initials ?? this.initials,
      hue: hue ?? this.hue,
      specialty: specialty ?? this.specialty,
      crm: crm ?? this.crm,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      isPartner: isPartner ?? this.isPartner,
      isPrescriber: isPrescriber ?? this.isPrescriber,
      isBuyer: isBuyer ?? this.isBuyer,
      isDecisionMaker: isDecisionMaker ?? this.isDecisionMaker,
      roleBadge: clearRoleBadge ? null : (roleBadge ?? this.roleBadge),
      education: education ?? this.education,
      birthdayLabel: birthdayLabel ?? this.birthdayLabel,
      favoriteTeam: favoriteTeam ?? this.favoriteTeam,
      interests: interests ?? this.interests,
      noteText: noteText ?? this.noteText,
      relationshipScore: relationshipScore ?? this.relationshipScore,
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────

String initialsFromName(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.length >= 2) {
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
  return name.isNotEmpty ? name[0].toUpperCase() : '?';
}

double hueFromName(String name) => (name.hashCode.abs() % 360).toDouble();

String? _formatCrm(String? number, String? state) {
  final n = number?.trim();
  if (n == null || n.isEmpty) return null;
  final s = state?.trim();
  if (s == null || s.isEmpty) return 'CRM $n';
  return 'CRM/$s $n';
}

String? _formatBirthday(DateTime? date) {
  if (date == null) return null;
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return '${date.day.toString().padLeft(2, '0')}/${months[date.month - 1]}';
}

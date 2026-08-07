import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_codes.dart';

/// Confirmed CRM doctor at a facility (roster context).
///
/// Maps from flat [FacilityProfessionalItemDTO]
/// (`/facilities/:id/healthcare-professionals`).
///
/// [id] is [personId] (cart/checkout / associate by person).
/// [personFacilityId] is the affiliation row id for PATCH / roles paths.
class ProfessionalRoster {
  const ProfessionalRoster({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    this.personFacilityId,
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

  /// Person id — used by cart/checkout (`personId`) and associate.
  final int id;

  /// `person_facilities.id` for PATCH `/healthcare-professionals/:id`
  /// and PUT `…/roles`.
  final int? personFacilityId;

  final String name;
  final String initials;
  final double hue;
  final String? specialty;
  final String? crm;

  /// Essential contact fields.
  final String? phone;
  final String? email;

  /// Mapped from projection [FacilityProfessionalItemDTO.roleCodes].
  final bool isPartner;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;

  /// Small highlight badge, e.g. "DECISORA", "NOVA".
  final String? roleBadge;

  /// "Formação" — no backing field yet.
  final String? education;

  /// "Aniversário" — not on projection DTO yet.
  final String? birthdayLabel;

  /// "Time" — not on projection DTO yet.
  final String? favoriteTeam;

  /// "Interesses" — not on projection DTO yet.
  final String? interests;

  /// Most recent note — person notes API not landed.
  final String? noteText;

  /// Relationship score — person relationship API not landed.
  final int? relationshipScore;

  factory ProfessionalRoster.fromRosterItem(FacilityProfessionalItemDTO item) {
    final name = item.displayName;
    final roles = HealthcareRoleCodes.toFlags(item.roleCodes);
    return ProfessionalRoster(
      id: item.personId,
      personFacilityId: item.personFacilityId,
      name: name,
      initials: initialsFromName(name),
      hue: hueFromName(name),
      specialty: item.roleTitle,
      phone: item.phone,
      email: item.email,
      isPartner: roles.isPartner,
      isPrescriber: roles.isPrescriber,
      isBuyer: roles.isBuyer,
      isDecisionMaker: roles.isDecisionMaker,
      roleBadge: roles.isDecisionMaker ? 'DECISOR' : null,
    );
  }

  ProfessionalRoster copyWith({
    int? id,
    int? personFacilityId,
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
      personFacilityId: personFacilityId ?? this.personFacilityId,
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

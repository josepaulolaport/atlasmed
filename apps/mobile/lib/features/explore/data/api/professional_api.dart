import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

// ── ProfessionalFacilityRef ─────────────────────────────────

class ProfessionalFacilityRef {
  const ProfessionalFacilityRef({required this.id, required this.name});

  factory ProfessionalFacilityRef.fromMap(Map<String, dynamic> map) {
    return ProfessionalFacilityRef(
      id: readCrmId(map['id'], 'id'),
      name: readString(map['name']),
    );
  }

  final int id;
  final String name;
}

// ── ProfessionalDTO ──────────────────────────────────────────

/// Unified DTO covering fields from all professional endpoints.
///
/// Used by:
/// - `GET /api/v1/professionals` (paginated list)
/// - `GET /api/v1/professionals/:id` (detail)
/// - `POST /api/v1/professionals` (create)
/// - `PATCH /api/v1/professionals/:id` (update)
/// - Embedded in facility professional items
class ProfessionalDTO {
  final int id;
  final String firstName;
  final String lastName;
  final String? fullName;
  final String? specialty;
  final String? crmNumber;
  final String? crmState;
  final String? mobilePhone;
  final String? landlinePhone;
  final String? email;
  final DateTime? birthDate;
  final String? favoriteTeam;
  final String? hobbies;
  final String? languages;
  final List<int> facilityIds;
  final ProfessionalFacilityRef? displayFacility;
  final int? relationshipLevel;
  final bool isPriority;

  // Detail-only
  final String? socialName;
  final String? taxId;
  final String? websiteUrl;
  final String? imageUrl;
  final String? imageBlurhash;
  final String? crmCouncil;
  final String? favoriteSport;
  final String? notes;
  final List<ProfessionalFacilityRef> facilities;

  /// Active clinics in the caller's scope (`GET /professionals/:id`).
  final double? distanceKm;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const ProfessionalDTO({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.facilityIds,
    this.facilities = const [],
    this.displayFacility,
    this.relationshipLevel,
    this.isPriority = false,
    this.fullName,
    this.specialty,
    this.crmNumber,
    this.crmState,
    this.mobilePhone,
    this.landlinePhone,
    this.email,
    this.birthDate,
    this.favoriteTeam,
    this.favoriteSport,
    this.hobbies,
    this.languages,
    this.socialName,
    this.taxId,
    this.websiteUrl,
    this.imageUrl,
    this.imageBlurhash,
    this.crmCouncil,
    this.notes,
    this.distanceKm,
    this.createdAt,
    this.updatedAt,
  });

  factory ProfessionalDTO.fromMap(Map<String, dynamic> map) {
    return ProfessionalDTO(
      id: readCrmId(map['id'], 'id'),
      firstName: readString(map['firstName']),
      lastName: readString(map['lastName']),
      fullName: readNullableString(map['fullName']),
      specialty: readNullableString(
        map['specialty'] ?? map['primarySpecialtyLabel'],
      ),
      crmNumber: readNullableString(map['crmNumber']),
      crmState: readNullableString(map['crmState']),
      mobilePhone: readNullableString(map['mobilePhone']),
      landlinePhone: readNullableString(map['landlinePhone']),
      email: readNullableString(map['email']),
      birthDate: readNullableDateTime(map['birthDate']),
      favoriteTeam: readNullableString(map['favoriteTeam']),
      favoriteSport: readNullableString(map['favoriteSport']),
      hobbies: readNullableString(map['hobbies']),
      languages: readNullableString(map['languages']),
      facilityIds: readCrmIdList(map['facilityIds'], 'facilityIds'),
      displayFacility: map['displayFacility'] is Map
          ? ProfessionalFacilityRef.fromMap(
              (map['displayFacility'] as Map).cast<String, dynamic>(),
            )
          : null,
      relationshipLevel: map['relationshipLevel'] is num
          ? (map['relationshipLevel'] as num).toInt()
          : null,
      isPriority: map['isPriority'] == true,
      facilities: readObjectList(
        map['facilities'],
      ).map(ProfessionalFacilityRef.fromMap).toList(growable: false),
      socialName: readNullableString(map['socialName']),
      taxId: readNullableString(map['taxId']),
      websiteUrl: readNullableString(map['websiteUrl']),
      imageUrl: readNullableString(map['imageUrl']),
      imageBlurhash: readNullableString(map['imageBlurhash']),
      crmCouncil: readNullableString(map['crmCouncil']),
      notes: readNullableString(map['notes']),
      distanceKm: readNullableDouble(map['distanceKm']),
      createdAt: readNullableDateTime(map['createdAt']),
      updatedAt: readNullableDateTime(map['updatedAt']),
    );
  }

  factory ProfessionalDTO.fromJson(String json) {
    return ProfessionalDTO.fromMap(jsonDecode(json) as Map<String, dynamic>);
  }

  String get displayName {
    final explicitName = fullName?.trim();
    if (explicitName != null && explicitName.isNotEmpty) {
      return explicitName;
    }
    return '$firstName $lastName'.trim();
  }

  String get crm {
    if (crmNumber == null || crmNumber!.isEmpty) {
      return '';
    }
    if (crmState == null || crmState!.isEmpty) {
      return crmNumber!;
    }
    return 'CRM-$crmState $crmNumber';
  }

  String? get phone {
    final mobile = mobilePhone?.trim();
    if (mobile != null && mobile.isNotEmpty) return mobile;
    final landline = landlinePhone?.trim();
    if (landline != null && landline.isNotEmpty) return landline;
    return null;
  }
}

// ── PaginatedProfessionals ───────────────────────────────────

class PaginatedProfessionals {
  const PaginatedProfessionals({required this.items, required this.pagination});

  factory PaginatedProfessionals.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedProfessionals.fromMap(decoded);
  }

  factory PaginatedProfessionals.fromMap(Map<String, dynamic> map) {
    return PaginatedProfessionals(
      items: readObjectList(
        map['data'],
      ).map(ProfessionalDTO.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<ProfessionalDTO> items;
  final Pagination pagination;
}

// ── ProfessionalAssociationDTO ───────────────────────────────

class ProfessionalAssociationDTO {
  final int facilityProfessionalId;
  final int facilityId;
  final int professionalId;
  final String occupationCode;
  final bool isPartner;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;
  final int? relationshipLevel;
  final String? specialtyLabel;
  final String? notes;

  const ProfessionalAssociationDTO({
    required this.facilityProfessionalId,
    required this.facilityId,
    required this.professionalId,
    this.occupationCode = '',
    this.isPartner = false,
    this.isPrescriber = false,
    this.isBuyer = false,
    this.isDecisionMaker = false,
    this.relationshipLevel,
    this.specialtyLabel,
    this.notes,
  });

  factory ProfessionalAssociationDTO.fromMap(Map<String, dynamic> map) {
    return ProfessionalAssociationDTO(
      facilityProfessionalId: readCrmId(map['facilityProfessionalId'], 'facilityProfessionalId'),
      facilityId: readCrmId(map['facilityId'], 'facilityId'),
      professionalId: readCrmId(map['professionalId'], 'professionalId'),
      occupationCode: readString(map['occupationCode']),
      isPartner: map['isPartner'] == true,
      isPrescriber: map['isPrescriber'] == true,
      isBuyer: map['isBuyer'] == true,
      isDecisionMaker: map['isDecisionMaker'] == true,
      specialtyLabel: readNullableString(map['specialtyLabel']),
      relationshipLevel: _readLevel(map['relationshipLevel']),
      notes: readNullableString(map['notes']),
    );
  }
}

// ── FacilityProfessionalItemDTO ──────────────────────────────

class FacilityProfessionalItemDTO {
  final int facilityProfessionalId;
  final ProfessionalDTO professional;
  final ProfessionalAssociationDTO association;

  const FacilityProfessionalItemDTO({
    required this.facilityProfessionalId,
    required this.professional,
    required this.association,
  });

  factory FacilityProfessionalItemDTO.fromMap(Map<String, dynamic> map) {
    return FacilityProfessionalItemDTO(
      facilityProfessionalId: readCrmId(map['facilityProfessionalId'], 'facilityProfessionalId'),
      professional: ProfessionalDTO.fromMap(
        (map['professional'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      association: ProfessionalAssociationDTO.fromMap(
        (map['association'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }
}

// ── PaginatedFacilityProfessionals ───────────────────────────

class PaginatedFacilityProfessionals {
  const PaginatedFacilityProfessionals({
    required this.items,
    required this.pagination,
  });

  factory PaginatedFacilityProfessionals.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedFacilityProfessionals.fromMap(decoded);
  }

  factory PaginatedFacilityProfessionals.fromMap(Map<String, dynamic> map) {
    return PaginatedFacilityProfessionals(
      items: readObjectList(
        map['data'],
      ).map(FacilityProfessionalItemDTO.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<FacilityProfessionalItemDTO> items;
  final Pagination pagination;
}

// ── Private helpers ──────────────────────────────────────────

int? _readLevel(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

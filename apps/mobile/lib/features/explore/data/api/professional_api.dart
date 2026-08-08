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

/// Unified DTO covering fields from healthcare-person endpoints.
///
/// Used by:
/// - `GET /api/v1/healthcare-professionals` (paginated list)
/// - `GET /api/v1/persons/:id` (detail)
/// - `PATCH /api/v1/persons/:id` (update)
/// - Embedded in facility professional items
class ProfessionalDTO {
  final int id;
  final String firstName;
  final String lastName;
  final String? fullName;
  final String? specialty;
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
  final String? favoriteSport;
  final String? notes;
  final List<ProfessionalFacilityRef> facilities;

  /// Distance from search origin when list includes geo (`GET /healthcare-professionals`).
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
      // COMPAT(remove): API canonical is `cpf`; field still named taxId on DTO.
      // Drop alias once mobile renames ProfessionalDTO.taxId → cpf.
      taxId: readNullableString(map['taxId'] ?? map['cpf']),
      websiteUrl: readNullableString(map['websiteUrl']),
      imageUrl: readNullableString(map['imageUrl']),
      imageBlurhash: readNullableString(map['imageBlurhash']),
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

  /// Registrations removed from list/detail DTO until multi-reg UI.
  String get crm => '';

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

// ── FacilityProfessionalItemDTO ──────────────────────────────

/// Flat projection from
/// `GET|POST|PATCH /facilities/:id/healthcare-professionals`.
class FacilityProfessionalItemDTO {
  final int personFacilityId;
  final int personId;
  final int facilityId;
  final String firstName;
  final String lastName;
  final String? socialName;
  final String? cpf;
  final String? email;
  final String? mobilePhone;
  final String? landlinePhone;
  final String? roleTitle;
  final String? notes;
  final bool hasHealthcareProfile;
  final List<int> classificationIds;
  final List<int> roleIds;

  const FacilityProfessionalItemDTO({
    required this.personFacilityId,
    required this.personId,
    required this.facilityId,
    required this.firstName,
    required this.lastName,
    this.socialName,
    this.cpf,
    this.email,
    this.mobilePhone,
    this.landlinePhone,
    this.roleTitle,
    this.notes,
    this.hasHealthcareProfile = false,
    this.classificationIds = const [],
    this.roleIds = const [],
  });

  factory FacilityProfessionalItemDTO.fromMap(Map<String, dynamic> map) {
    return FacilityProfessionalItemDTO(
      personFacilityId: readCrmId(map['personFacilityId'], 'personFacilityId'),
      personId: readCrmId(map['personId'], 'personId'),
      facilityId: readCrmId(map['facilityId'], 'facilityId'),
      firstName: readString(map['firstName']),
      lastName: readString(map['lastName']),
      socialName: readNullableString(map['socialName']),
      cpf: readNullableString(map['cpf']),
      email: readNullableString(map['email']),
      mobilePhone: readNullableString(map['mobilePhone']),
      landlinePhone: readNullableString(map['landlinePhone']),
      roleTitle: readNullableString(map['roleTitle']),
      notes: readNullableString(map['notes']),
      hasHealthcareProfile: map['hasHealthcareProfile'] == true,
      classificationIds: readCrmIdList(
        map['classificationIds'],
        'classificationIds',
      ),
      roleIds: readCrmIdList(map['roleIds'], 'roleIds'),
    );
  }

  String get displayName {
    final social = socialName?.trim();
    if (social != null && social.isNotEmpty) return social;
    return '$firstName $lastName'.trim();
  }

  String? get phone {
    final mobile = mobilePhone?.trim();
    if (mobile != null && mobile.isNotEmpty) return mobile;
    final landline = landlinePhone?.trim();
    if (landline != null && landline.isNotEmpty) return landline;
    return null;
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
    final items = readObjectList(
      map['data'],
    ).map(FacilityProfessionalItemDTO.fromMap).toList(growable: false);
    final paginationMap = (map['pagination'] as Map?)?.cast<String, dynamic>();
    // Projection list endpoints return `{ data: [...] }` with no pagination.
    final pagination = paginationMap != null
        ? Pagination.fromMap(paginationMap)
        : Pagination(
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: 1,
          );
    return PaginatedFacilityProfessionals(items: items, pagination: pagination);
  }

  final List<FacilityProfessionalItemDTO> items;
  final Pagination pagination;
}

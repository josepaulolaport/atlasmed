import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

// ── ClinicalFocus ───────────────────────────────────────────

/// Coberto por GET /facilities e GET /facilities/:id — clinicalFocuses array.
class ClinicalFocus {
  final int id;
  final String name;
  final String? cnesCode;

  const ClinicalFocus({required this.id, required this.name, this.cnesCode});

  factory ClinicalFocus.fromMap(Map<String, dynamic> map) {
    return ClinicalFocus(
      id: readCrmId(map['id'], 'id'),
      name: readString(map['name']),
      cnesCode: readNullableString(map['cnesCode']),
    );
  }
}

/// Active vertical profile on a facility (subset of API `verticalProfiles`).
class FacilityVerticalProfileDTO {
  const FacilityVerticalProfileDTO({
    required this.verticalId,
    required this.verticalName,
    this.verticalCode,
    this.commercialStatus,
    this.territoryId,
    this.purchaseRecurrence,
  });

  final int verticalId;
  final String verticalName;
  final String? verticalCode;
  final String? commercialStatus;
  final int? territoryId;
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;

  factory FacilityVerticalProfileDTO.fromMap(Map<String, dynamic> map) {
    return FacilityVerticalProfileDTO(
      verticalId: readCrmId(map['verticalId'], 'verticalId'),
      verticalName: readString(map['verticalName']),
      verticalCode: readNullableString(map['verticalCode']),
      commercialStatus: readNullableString(map['commercialStatus']),
      territoryId: readCrmIdOrNull(map['territoryId'], 'territoryId'),
      purchaseRecurrence: map['purchaseRecurrence'] is Map
          ? PurchaseRecurrenceSnapshot.fromMap(
              (map['purchaseRecurrence'] as Map).cast<String, dynamic>(),
            )
          : null,
    );
  }
}

/// Prefer [verticalId] when set; else the sole profile; else null.
FacilityVerticalProfileDTO? pickVerticalProfile(
  List<FacilityVerticalProfileDTO> profiles, {
  int? verticalId,
}) {
  if (profiles.isEmpty) return null;
  if (verticalId != null) {
    for (final profile in profiles) {
      if (profile.verticalId == verticalId) return profile;
    }
    return null;
  }
  if (profiles.length == 1) return profiles.first;
  return null;
}

/// Prefer API-derived status when present; otherwise infer from territory links.
String resolveTerritoryAssignmentStatus({
  String? apiStatus,
  int? territoryId,
  List<FacilityVerticalProfileDTO> verticalProfiles = const [],
}) {
  if (apiStatus != null && apiStatus.isNotEmpty) return apiStatus;
  final hasProfileTerritory = verticalProfiles.any(
    (p) => p.territoryId != null,
  );
  return territoryId != null || hasProfileTerritory ? 'assigned' : 'unassigned';
}

// ── FacilityDTO ─────────────────────────────────────────────

/// DTO único para facility — cobre campos de GET /facilities e GET /facilities/:id.
class FacilityDTO {
  final int id;
  final String name;
  final String? neighborhood;
  final String? city;
  final String? state;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;
  final String? postalCode;
  final String? phone;
  final String? whatsapp;
  final String? email;
  final String? website;
  final String? billingEmail;
  final String? responsibleName;
  final String? openingHours;
  final String? registeredSince;
  final String? legalDocumentType;
  final String? legalDocument;
  final double? lat;
  final double? lng;
  final int? territoryId;
  final String? territoryName;
  final String? territoryAssignmentStatus;
  final String? conformityStatus;
  final int professionalCount;
  final String? consultantName;
  final String? consultantSince;
  final String? managerName;
  final String? imageUrl;
  final String? imageBlurhash;
  final String? cnesCode;
  final int? unitTypeId;
  final int? unitSubtypeId;
  final double? distanceKm;
  final String? lastVisitAt;
  final List<ClinicalFocus> clinicalFocuses;
  final List<FacilityVerticalProfileDTO> verticalProfiles;
  final String? createdAt;
  final String? updatedAt;

  const FacilityDTO({
    required this.id,
    required this.name,
    required this.professionalCount,
    this.neighborhood,
    this.city,
    this.state,
    this.streetAddress,
    this.streetNumber,
    this.addressComplement,
    this.postalCode,
    this.phone,
    this.whatsapp,
    this.email,
    this.website,
    this.billingEmail,
    this.responsibleName,
    this.openingHours,
    this.registeredSince,
    this.legalDocumentType,
    this.legalDocument,
    this.lat,
    this.lng,
    this.territoryId,
    this.territoryName,
    this.territoryAssignmentStatus,
    this.conformityStatus,
    this.consultantName,
    this.consultantSince,
    this.managerName,
    this.imageUrl,
    this.imageBlurhash,
    this.cnesCode,
    this.unitTypeId,
    this.unitSubtypeId,
    this.distanceKm,
    this.lastVisitAt,
    this.clinicalFocuses = const [],
    this.verticalProfiles = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory FacilityDTO.fromJson(String json) {
    return FacilityDTO.fromMap(jsonDecode(json) as Map<String, dynamic>);
  }

  factory FacilityDTO.fromMap(Map<String, dynamic> map) {
    final territoryId = readCrmIdOrNull(map['territoryId'], 'territoryId');
    final verticalProfiles = readObjectList(map['verticalProfiles'])
        .map(FacilityVerticalProfileDTO.fromMap)
        .where((p) => p.verticalId > 0)
        .toList(growable: false);

    return FacilityDTO(
      id: readCrmId(map['id'], 'id'),
      name: readString(map['name']),
      neighborhood: readNullableString(map['neighborhood']),
      city: readNullableString(map['city']),
      state: readNullableString(map['state']),
      streetAddress: readNullableString(map['streetAddress']),
      streetNumber: readNullableString(map['streetNumber']),
      addressComplement: readNullableString(map['addressComplement']),
      postalCode: readNullableString(
        map['postalCode'] ?? map['cep'] ?? map['zipCode'],
      ),
      phone: readNullableString(map['phone']),
      whatsapp: readNullableString(map['whatsapp']),
      email: readNullableString(map['email']),
      website: readNullableString(map['website']),
      billingEmail: readNullableString(map['billingEmail']),
      responsibleName: readNullableString(map['responsibleName']),
      openingHours: readNullableString(map['openingHours']),
      registeredSince: readNullableString(map['registeredSince']),
      legalDocumentType: readNullableString(map['legalDocumentType']),
      legalDocument: readNullableString(map['legalDocument']),
      lat: readNullableDouble(map['lat']),
      lng: readNullableDouble(map['lng']),
      territoryId: territoryId,
      territoryName: readNullableString(map['territoryName']),
      territoryAssignmentStatus: resolveTerritoryAssignmentStatus(
        apiStatus: readNullableString(map['territoryAssignmentStatus']),
        territoryId: territoryId,
        verticalProfiles: verticalProfiles,
      ),
      conformityStatus: readNullableString(map['conformityStatus']),
      professionalCount: readInt(map['professionalCount']),
      consultantName: readNullableString(map['consultantName']),
      consultantSince: readNullableString(map['consultantSince']),
      managerName: readNullableString(map['managerName']),
      imageUrl: readNullableString(map['imageUrl'] ?? map['profileImageUrl']),
      imageBlurhash: readNullableString(map['imageBlurhash']),
      cnesCode: readNullableString(map['cnesCode']),
      unitTypeId: readCrmIdOrNull(map['unitTypeId'], 'unitTypeId'),
      unitSubtypeId: readCrmIdOrNull(map['unitSubtypeId'], 'unitSubtypeId'),
      distanceKm: readNullableDouble(map['distanceKm']),
      lastVisitAt: readNullableString(map['lastVisitAt']),
      clinicalFocuses: readObjectList(
        map['clinicalFocuses'],
      ).map(ClinicalFocus.fromMap).toList(growable: false),
      verticalProfiles: verticalProfiles,
      createdAt: readNullableString(map['createdAt']),
      updatedAt: readNullableString(map['updatedAt']),
    );
  }
}

// ── PaginatedFacilities ─────────────────────────────────────

class PaginatedFacilities {
  const PaginatedFacilities({required this.items, required this.pagination});

  factory PaginatedFacilities.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedFacilities.fromMap(decoded);
  }

  factory PaginatedFacilities.fromMap(Map<String, dynamic> map) {
    return PaginatedFacilities(
      items: readObjectList(
        map['data'],
      ).map(FacilityDTO.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<FacilityDTO> items;
  final Pagination pagination;
}

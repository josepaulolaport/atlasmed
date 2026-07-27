import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

// ── ClinicService ───────────────────────────────────────────

/// Coberto por GET /facilities e GET /facilities/:id — services array.
class ClinicService {
  final String serviceCode;
  final String classificationCode;

  const ClinicService({
    required this.serviceCode,
    required this.classificationCode,
  });

  factory ClinicService.fromMap(Map<String, dynamic> map) {
    return ClinicService(
      serviceCode: readString(map['serviceCode']),
      classificationCode: readString(map['classificationCode']),
    );
  }
}

// ── FacilityDTO ─────────────────────────────────────────────

/// DTO único para facility — cobre campos de GET /facilities e GET /facilities/:id.
class FacilityDTO {
  final String id;
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
  final String? taxIdType;
  final String? cnpj;
  final String? cpf;
  final double? lat;
  final double? lng;
  final String? territoryId;
  final String? territoryName;
  final String? territoryAssignmentStatus;
  final String? commercialStatus;
  final String? conformityStatus;
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;
  final int professionalCount;
  final String? consultantName;
  final String? consultantSince;
  final String? managerName;
  final String? imageUrl;
  final String? imageBlurhash;
  final double? distanceKm;
  final String? lastVisitAt;
  final List<ClinicService> services;
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
    this.taxIdType,
    this.cnpj,
    this.cpf,
    this.lat,
    this.lng,
    this.territoryId,
    this.territoryName,
    this.territoryAssignmentStatus,
    this.commercialStatus,
    this.conformityStatus,
    this.purchaseRecurrence,
    this.consultantName,
    this.consultantSince,
    this.managerName,
    this.imageUrl,
    this.imageBlurhash,
    this.distanceKm,
    this.lastVisitAt,
    this.services = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory FacilityDTO.fromJson(String json) {
    return FacilityDTO.fromMap(jsonDecode(json) as Map<String, dynamic>);
  }

  factory FacilityDTO.fromMap(Map<String, dynamic> map) {
    return FacilityDTO(
      id: readString(map['id']),
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
      taxIdType: readNullableString(map['taxIdType']),
      cnpj: readNullableString(map['cnpj']),
      cpf: readNullableString(map['cpf']),
      lat: readNullableDouble(map['lat']),
      lng: readNullableDouble(map['lng']),
      territoryId: readNullableString(map['territoryId']),
      territoryName: readNullableString(map['territoryName']),
      territoryAssignmentStatus: readNullableString(
        map['territoryAssignmentStatus'],
      ),
      commercialStatus: readNullableString(map['commercialStatus']),
      conformityStatus: readNullableString(map['conformityStatus']),
      purchaseRecurrence: map['purchaseRecurrence'] is Map
          ? PurchaseRecurrenceSnapshot.fromMap(
              (map['purchaseRecurrence'] as Map).cast<String, dynamic>(),
            )
          : null,
      professionalCount: readInt(map['professionalCount']),
      consultantName: readNullableString(map['consultantName']),
      consultantSince: readNullableString(map['consultantSince']),
      managerName: readNullableString(map['managerName']),
      imageUrl: readNullableString(map['imageUrl'] ?? map['profileImageUrl']),
      imageBlurhash: readNullableString(map['imageBlurhash']),
      distanceKm: readNullableDouble(map['distanceKm']),
      lastVisitAt: readNullableString(map['lastVisitAt']),
      services: readObjectList(
        map['services'],
      ).map(ClinicService.fromMap).toList(growable: false),
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

import 'dart:convert';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Shared API response types for the explore feature's clinic domain.
/// Used by [ClinicsRepository].

class Clinic {
  const Clinic({
    required this.id,
    required this.name,
    required this.professionalCount,
    this.neighborhood,
    this.city,
    this.state,
    this.territoryId,
    this.territoryAssignmentStatus,
    this.consultantName,
    this.distanceKm,
    this.lat,
    this.lng,
    this.services = const [],
    this.phone,
    this.whatsapp,
    this.email,
    this.website,
    this.responsibleName,
    this.openingHours,
    this.registeredSince,
    this.streetAddress,
    this.streetNumber,
    this.addressComplement,
    this.postalCode,
    this.taxIdType,
    this.cnpj,
    this.cpf,
    this.createdAt,
    this.updatedAt,
  });

  factory Clinic.fromMap(Map<String, dynamic> map) {
    return Clinic(
      id: readString(map['id']),
      name: readString(map['name']),
      neighborhood: readNullableString(map['neighborhood']),
      city: readNullableString(map['city']),
      state: readNullableString(map['state']),
      territoryId: readNullableString(map['territoryId']),
      territoryAssignmentStatus: readNullableString(
        map['territoryAssignmentStatus'],
      ),
      professionalCount: readInt(map['professionalCount']),
      consultantName: readNullableString(map['consultantName']),
      distanceKm: readNullableDouble(map['distanceKm']),
      lat: readNullableDouble(map['lat']),
      lng: readNullableDouble(map['lng']),
      services: readObjectList(
        map['services'],
      ).map(ClinicService.fromMap).toList(growable: false),
      phone: readNullableString(map['phone']),
      whatsapp: readNullableString(map['whatsapp']),
      email: readNullableString(map['email']),
      website: readNullableString(map['website']),
      responsibleName: readNullableString(map['responsibleName']),
      openingHours: readNullableString(map['openingHours']),
      registeredSince: readNullableDateTime(map['registeredSince']),
      streetAddress: readNullableString(map['streetAddress']),
      streetNumber: readNullableString(map['streetNumber']),
      addressComplement: readNullableString(map['addressComplement']),
      postalCode: readNullableString(
        map['postalCode'] ?? map['cep'] ?? map['zipCode'],
      ),
      taxIdType: readNullableString(map['taxIdType']),
      cnpj: readNullableString(map['cnpj']),
      cpf: readNullableString(map['cpf']),
      createdAt: readNullableDateTime(map['createdAt']),
      updatedAt: readNullableDateTime(map['updatedAt']),
    );
  }

  final String id;
  final String name;
  final String? neighborhood;
  final String? city;
  final String? state;
  final String? territoryId;
  final String? territoryAssignmentStatus;
  final int professionalCount;
  final String? consultantName;
  final double? distanceKm;
  final double? lat;
  final double? lng;
  final List<ClinicService> services;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Detail fields from GET /facilities/:id (and list when present)
  final String? phone;
  final String? whatsapp;
  final String? email;
  final String? website;
  final String? responsibleName;
  final String? openingHours;
  final DateTime? registeredSince;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;
  final String? postalCode;
  final String? taxIdType;
  final String? cnpj;
  final String? cpf;
}

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

class PaginatedClinics {
  const PaginatedClinics({required this.items, required this.pagination});

  factory PaginatedClinics.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedClinics.fromMap(decoded);
  }

  factory PaginatedClinics.fromMap(Map<String, dynamic> map) {
    return PaginatedClinics(
      items: readObjectList(
        map['data'],
      ).map(Clinic.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<Clinic> items;
  final Pagination pagination;
}

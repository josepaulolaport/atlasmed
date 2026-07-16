import 'dart:convert';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Shared API response types for the explore feature's clinic domain.
/// Used by [ClinicsRepository].

class Clinic {
  const Clinic({
    required this.id,
    required this.name,
    required this.professionalCount,
    this.city,
    this.state,
    this.territoryId,
    this.territoryAssignmentStatus,
    this.consultantName,
    this.distanceKm,
    this.services = const [],
    this.phone,
    this.email,
    this.website,
    this.streetAddress,
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
      city: readNullableString(map['city']),
      state: readNullableString(map['state']),
      territoryId: readNullableString(map['territoryId']),
      territoryAssignmentStatus: readNullableString(
        map['territoryAssignmentStatus'],
      ),
      professionalCount: readInt(map['professionalCount']),
      consultantName: readNullableString(map['consultantName']),
      distanceKm: readNullableDouble(map['distanceKm']),
      services: readObjectList(
        map['services'],
      ).map(ClinicService.fromMap).toList(growable: false),
      phone: readNullableString(map['phone']),
      email: readNullableString(map['email']),
      website: readNullableString(map['website']),
      streetAddress: readNullableString(map['streetAddress']),
      taxIdType: readNullableString(map['taxIdType']),
      cnpj: readNullableString(map['cnpj']),
      cpf: readNullableString(map['cpf']),
      createdAt: readNullableDateTime(map['createdAt']),
      updatedAt: readNullableDateTime(map['updatedAt']),
    );
  }

  final String id;
  final String name;
  final String? city;
  final String? state;
  final String? territoryId;
  final String? territoryAssignmentStatus;
  final int professionalCount;
  final String? consultantName;
  final double? distanceKm;
  final List<ClinicService> services;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Detail-only fields (filled when fetching single clinic)
  final String? phone;
  final String? email;
  final String? website;
  final String? streetAddress;
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

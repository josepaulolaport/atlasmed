import 'dart:convert';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Shared API response types for the explore feature's doctor domain.
/// Used by [DoctorsRepository].

class ApiDoctor {
  const ApiDoctor({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.facilityIds,
    this.fullName,
    this.specialty,
    this.crmNumber,
    this.crmState,
    this.distanceKm,
    this.createdAt,
    this.updatedAt,
  });

  factory ApiDoctor.fromMap(Map<String, dynamic> map) {
    return ApiDoctor(
      id: readString(map['id']),
      firstName: readString(map['firstName']),
      lastName: readString(map['lastName']),
      fullName: readNullableString(map['fullName']),
      specialty: readNullableString(
        map['specialty'] ?? map['primarySpecialtyLabel'],
      ),
      crmNumber: readNullableString(map['crmNumber']),
      crmState: readNullableString(map['crmState']),
      facilityIds: readStringList(map['facilityIds']),
      distanceKm: readNullableDouble(map['distanceKm']),
      createdAt: readNullableDateTime(map['createdAt']),
      updatedAt: readNullableDateTime(map['updatedAt']),
    );
  }

  final String id;
  final String firstName;
  final String lastName;
  final String? fullName;
  final String? specialty;
  final String? crmNumber;
  final String? crmState;
  final List<String> facilityIds;
  final double? distanceKm;
  final DateTime? createdAt;
  final DateTime? updatedAt;

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
}

class PaginatedDoctors {
  const PaginatedDoctors({required this.items, required this.pagination});

  factory PaginatedDoctors.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedDoctors.fromMap(decoded);
  }

  factory PaginatedDoctors.fromMap(Map<String, dynamic> map) {
    return PaginatedDoctors(
      items: readObjectList(
        map['data'],
      ).map(ApiDoctor.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<ApiDoctor> items;
  final Pagination pagination;
}

import 'dart:convert';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Shared API response types for the explore feature's doctor domain.
/// Used by [DoctorsRepository].

class ApiDoctorFacility {
  const ApiDoctorFacility({required this.id, required this.name});

  factory ApiDoctorFacility.fromMap(Map<String, dynamic> map) {
    return ApiDoctorFacility(
      id: readString(map['id']),
      name: readString(map['name']),
    );
  }

  final String id;
  final String name;
}

class ApiDoctor {
  factory ApiDoctor.fromJson(String json) {
    return ApiDoctor.fromMap(jsonDecode(json) as Map<String, dynamic>);
  }

  const ApiDoctor({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.facilityIds,
    this.facilities = const [],
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
    this.languages,
    this.hobbies,
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
      mobilePhone: readNullableString(map['mobilePhone']),
      landlinePhone: readNullableString(map['landlinePhone']),
      email: readNullableString(map['email']),
      birthDate: readNullableDateTime(map['birthDate']),
      favoriteTeam: readNullableString(map['favoriteTeam']),
      favoriteSport: readNullableString(map['favoriteSport']),
      languages: readNullableString(map['languages']),
      hobbies: readNullableString(map['hobbies']),
      facilityIds: readStringList(map['facilityIds']),
      facilities: readObjectList(
        map['facilities'],
      ).map(ApiDoctorFacility.fromMap).toList(growable: false),
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
  final String? mobilePhone;
  final String? landlinePhone;
  final String? email;
  final DateTime? birthDate;
  final String? favoriteTeam;
  final String? favoriteSport;
  final String? languages;
  final String? hobbies;
  final List<String> facilityIds;

  /// Active clinics in the caller's scope (`GET /professionals/:id`).
  final List<ApiDoctorFacility> facilities;
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

  String? get phone {
    final mobile = mobilePhone?.trim();
    if (mobile != null && mobile.isNotEmpty) return mobile;
    final landline = landlinePhone?.trim();
    if (landline != null && landline.isNotEmpty) return landline;
    return null;
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

import 'dart:convert';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Shared API response types for the explore feature's doctor domain.
/// Used by [DoctorsRepository] and doctor detail hydration.

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
  const ApiDoctor({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.facilityIds,
    this.fullName,
    this.specialty,
    this.crmCouncil,
    this.crmNumber,
    this.crmState,
    this.mobilePhone,
    this.whatsappNumber,
    this.landlinePhone,
    this.email,
    this.birthDate,
    this.faculty,
    this.residency,
    this.languages,
    this.favoriteTeam,
    this.favoriteSport,
    this.hobbies,
    this.facilities = const [],
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
      crmCouncil: readNullableString(map['crmCouncil']),
      crmNumber: readNullableString(map['crmNumber']),
      crmState: readNullableString(map['crmState']),
      mobilePhone: readNullableString(map['mobilePhone']),
      whatsappNumber: readNullableString(map['whatsappNumber']),
      landlinePhone: readNullableString(map['landlinePhone']),
      email: readNullableString(map['email']),
      birthDate: readNullableString(map['birthDate']),
      faculty: readNullableString(map['faculty']),
      residency: readNullableString(map['residency']),
      languages: readNullableString(map['languages']),
      favoriteTeam: readNullableString(map['favoriteTeam']),
      favoriteSport: readNullableString(map['favoriteSport']),
      hobbies: readNullableString(map['hobbies']),
      facilityIds: readStringList(map['facilityIds']),
      facilities: readObjectList(map['facilities'])
          .map(ApiDoctorFacility.fromMap)
          .toList(growable: false),
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
  final String? crmCouncil;
  final String? crmNumber;
  final String? crmState;
  final String? mobilePhone;
  final String? whatsappNumber;
  final String? landlinePhone;
  final String? email;
  final String? birthDate;
  final String? faculty;
  final String? residency;
  final String? languages;
  final String? favoriteTeam;
  final String? favoriteSport;
  final String? hobbies;
  final List<String> facilityIds;
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

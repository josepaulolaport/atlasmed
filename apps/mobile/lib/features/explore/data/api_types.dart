import 'dart:convert';

/// Shared API response types for the explore feature.
/// Used by both [ClinicsRepository] and [DoctorsRepository].

class Pagination {
  const Pagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory Pagination.fromMap(Map<String, dynamic> map) {
    return Pagination(
      page: _readInt(map['page']),
      limit: _readInt(map['limit']),
      total: _readInt(map['total']),
      totalPages: _readInt(map['totalPages']),
    );
  }

  final int page;
  final int limit;
  final int total;
  final int totalPages;
}

class ApiClinic {
  const ApiClinic({
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
    this.cnpj,
    this.cpf,
    this.createdAt,
    this.updatedAt,
  });

  factory ApiClinic.fromMap(Map<String, dynamic> map) {
    return ApiClinic(
      id: _readString(map['id']),
      name: _readString(map['name']),
      city: _readNullableString(map['city']),
      state: _readNullableString(map['state']),
      territoryId: _readNullableString(map['territoryId']),
      territoryAssignmentStatus: _readNullableString(
        map['territoryAssignmentStatus'],
      ),
      professionalCount: _readInt(map['professionalCount']),
      consultantName: _readNullableString(map['consultantName']),
      distanceKm: _readNullableDouble(map['distanceKm']),
      services: _readObjectList(
        map['services'],
      ).map(ApiClinicService.fromMap).toList(growable: false),
      phone: _readNullableString(map['phone']),
      email: _readNullableString(map['email']),
      website: _readNullableString(map['website']),
      streetAddress: _readNullableString(map['streetAddress']),
      cnpj: _readNullableString(map['cnpj']),
      cpf: _readNullableString(map['cpf']),
      createdAt: _readNullableDateTime(map['createdAt']),
      updatedAt: _readNullableDateTime(map['updatedAt']),
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
  final List<ApiClinicService> services;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Detail-only fields (filled when fetching single clinic)
  final String? phone;
  final String? email;
  final String? website;
  final String? streetAddress;
  final String? cnpj;
  final String? cpf;
}

class ApiClinicService {
  final String serviceCode;
  final String classificationCode;

  const ApiClinicService({
    required this.serviceCode,
    required this.classificationCode,
  });

  factory ApiClinicService.fromMap(Map<String, dynamic> map) {
    return ApiClinicService(
      serviceCode: _readString(map['serviceCode']),
      classificationCode: _readString(map['classificationCode']),
    );
  }
}

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
      id: _readString(map['id']),
      firstName: _readString(map['firstName']),
      lastName: _readString(map['lastName']),
      fullName: _readNullableString(map['fullName']),
      specialty: _readNullableString(
        map['specialty'] ?? map['primarySpecialtyLabel'],
      ),
      crmNumber: _readNullableString(map['crmNumber']),
      crmState: _readNullableString(map['crmState']),
      facilityIds: _readStringList(map['facilityIds']),
      distanceKm: _readNullableDouble(map['distanceKm']),
      createdAt: _readNullableDateTime(map['createdAt']),
      updatedAt: _readNullableDateTime(map['updatedAt']),
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

class PaginatedClinics {
  const PaginatedClinics({required this.items, required this.pagination});

  factory PaginatedClinics.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedClinics.fromMap(decoded);
  }

  factory PaginatedClinics.fromMap(Map<String, dynamic> map) {
    return PaginatedClinics(
      items: _readObjectList(
        map['data'],
      ).map(ApiClinic.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<ApiClinic> items;
  final Pagination pagination;
}

class PaginatedDoctors {
  const PaginatedDoctors({required this.items, required this.pagination});

  factory PaginatedDoctors.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedDoctors.fromMap(decoded);
  }

  factory PaginatedDoctors.fromMap(Map<String, dynamic> map) {
    return PaginatedDoctors(
      items: _readObjectList(
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

Uri buildEndpoint({
  required String baseUrl,
  required String path,
  required Map<String, String> queryParameters,
}) {
  final base = Uri.parse(baseUrl);
  final basePath = base.path.endsWith('/')
      ? base.path.substring(0, base.path.length - 1)
      : base.path;

  return base.replace(path: '$basePath$path', queryParameters: queryParameters);
}

List<Map<String, dynamic>> _readObjectList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => item.cast<String, dynamic>())
      .toList(growable: false);
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.whereType<String>().toList(growable: false);
}

String _readString(Object? value) => value?.toString() ?? '';

String? _readNullableString(Object? value) {
  final stringValue = value?.toString();
  if (stringValue == null || stringValue.isEmpty) {
    return null;
  }
  return stringValue;
}

int _readInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double? _readNullableDouble(Object? value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '');
}

DateTime? _readNullableDateTime(Object? value) {
  final stringValue = _readNullableString(value);
  if (stringValue == null) {
    return null;
  }
  return DateTime.tryParse(stringValue);
}

import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// DTO from `GET /facilities/:id/representatives`.
///
/// No relationship field — stars apply only to user × professional (doctors).
class FacilityRepresentativeApi {
  const FacilityRepresentativeApi({
    required this.id,
    required this.facilityId,
    required this.representativeName,
    this.roleTitle,
    this.email,
    this.phone,
    this.taxId,
    required this.contactType,
    this.sourceProvider,
    this.confirmedAt,
  });

  factory FacilityRepresentativeApi.fromMap(Map<String, dynamic> map) {
    return FacilityRepresentativeApi(
      id: readString(map['id']),
      facilityId: readString(map['facilityId']),
      representativeName: readString(map['representativeName']),
      roleTitle: readNullableString(map['roleTitle']),
      email: readNullableString(map['email']),
      phone: readNullableString(map['phone']),
      taxId: readNullableString(map['taxId']),
      contactType: readString(map['contactType']).isEmpty
          ? 'PROFESSIONAL'
          : readString(map['contactType']),
      sourceProvider: readNullableString(map['sourceProvider']),
      confirmedAt: readNullableDateTime(map['confirmedAt']),
    );
  }

  final String id;
  final String facilityId;
  final String representativeName;
  final String? roleTitle;
  final String? email;
  final String? phone;
  final String? taxId;
  final String contactType;
  final String? sourceProvider;
  final DateTime? confirmedAt;

  AdministrativeProfessional toDomain() {
    return AdministrativeProfessional(
      id: id,
      name: representativeName,
      roleTitle: roleTitle,
      email: email,
      phone: phone,
      contactType: contactType,
    );
  }
}

class PaginatedFacilityRepresentatives {
  const PaginatedFacilityRepresentatives({
    required this.items,
    required this.pagination,
  });

  factory PaginatedFacilityRepresentatives.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedFacilityRepresentatives.fromMap(decoded);
  }

  factory PaginatedFacilityRepresentatives.fromMap(Map<String, dynamic> map) {
    return PaginatedFacilityRepresentatives(
      items: readObjectList(
        map['data'],
      ).map(FacilityRepresentativeApi.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<FacilityRepresentativeApi> items;
  final Pagination pagination;
}

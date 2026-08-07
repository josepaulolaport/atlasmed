import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Flat projection from
/// `GET|POST|PATCH /facilities/:id/administrative-contacts`.
class FacilityRepresentativeApi {
  const FacilityRepresentativeApi({
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
    this.classificationCodes = const [],
  });

  factory FacilityRepresentativeApi.fromMap(Map<String, dynamic> map) {
    return FacilityRepresentativeApi(
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
      classificationCodes: readStringList(map['classificationCodes']),
    );
  }

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
  final List<String> classificationCodes;

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

  /// Domain [AdministrativeProfessional.id] = [personFacilityId] for PATCH.
  AdministrativeProfessional toDomain() {
    return AdministrativeProfessional(
      id: personFacilityId,
      name: displayName,
      roleTitle: roleTitle,
      email: email,
      phone: phone,
      contactType: 'PROFESSIONAL',
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
    final items = readObjectList(
      map['data'],
    ).map(FacilityRepresentativeApi.fromMap).toList(growable: false);
    final paginationMap = (map['pagination'] as Map?)?.cast<String, dynamic>();
    final pagination = paginationMap != null
        ? Pagination.fromMap(paginationMap)
        : Pagination(
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: 1,
          );
    return PaginatedFacilityRepresentatives(
      items: items,
      pagination: pagination,
    );
  }

  final List<FacilityRepresentativeApi> items;
  final Pagination pagination;
}

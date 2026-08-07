import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// DTO from `GET|POST|PATCH /facilities/:id/representatives`.
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
    this.isPartner = false,
    this.isAdministrator = false,
    this.isDecisionMaker = false,
    this.isBuyer = false,
    this.isBiller = false,
    this.isSecretary = false,
    this.relationshipLevel,
    this.confirmedAt,
  });

  factory FacilityRepresentativeApi.fromMap(Map<String, dynamic> map) {
    return FacilityRepresentativeApi(
      id: readCrmId(map['id'], 'id'),
      facilityId: readCrmId(map['facilityId'], 'facilityId'),
      representativeName: readString(map['representativeName']),
      roleTitle: readNullableString(map['roleTitle']),
      email: readNullableString(map['email']),
      phone: readNullableString(map['phone']),
      taxId: readNullableString(map['taxId']),
      contactType: readString(map['contactType']).isEmpty
          ? 'PROFESSIONAL'
          : readString(map['contactType']),
      isPartner: map['isPartner'] == true,
      isAdministrator: map['isAdministrator'] == true,
      isDecisionMaker: map['isDecisionMaker'] == true,
      isBuyer: map['isBuyer'] == true,
      isBiller: map['isBiller'] == true,
      isSecretary: map['isSecretary'] == true,
      relationshipLevel: _readLevel(map['relationshipLevel']),
      confirmedAt: readNullableDateTime(map['confirmedAt']),
    );
  }

  final int id;
  final int facilityId;
  final String representativeName;
  final String? roleTitle;
  final String? email;
  final String? phone;
  final String? taxId;
  final String contactType;
  final bool isPartner;
  final bool isAdministrator;
  final bool isDecisionMaker;
  final bool isBuyer;
  final bool isBiller;
  final bool isSecretary;
  final int? relationshipLevel;
  final DateTime? confirmedAt;

  AdministrativeProfessional toDomain() {
    return AdministrativeProfessional(
      id: id,
      name: representativeName,
      roleTitle: roleTitle,
      email: email,
      phone: phone,
      contactType: contactType,
      isPartner: isPartner,
      isAdministrator: isAdministrator,
      isDecisionMaker: isDecisionMaker,
      isBuyer: isBuyer,
      isBiller: isBiller,
      isSecretary: isSecretary,
      relationshipScore: relationshipLevel,
    );
  }

  static int? _readLevel(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return null;
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

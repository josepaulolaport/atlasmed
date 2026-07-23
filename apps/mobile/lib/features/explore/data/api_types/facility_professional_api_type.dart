import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_associate_mock.dart';

/// DTO from `GET /facilities/:id/professionals`.
///
/// [association.relationshipLevel] is the authenticated user's score from
/// `user_professional_relationships` (1–10) — shown as Relacionamento stars.
class FacilityProfessionalListItemApi {
  const FacilityProfessionalListItemApi({
    required this.facilityProfessionalId,
    required this.professional,
    required this.association,
  });

  factory FacilityProfessionalListItemApi.fromMap(Map<String, dynamic> map) {
    return FacilityProfessionalListItemApi(
      facilityProfessionalId: readString(map['facilityProfessionalId']),
      professional: FacilityProfessionalSummaryApi.fromMap(
        (map['professional'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      association: FacilityProfessionalAssociationApi.fromMap(
        (map['association'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final String facilityProfessionalId;
  final FacilityProfessionalSummaryApi professional;
  final FacilityProfessionalAssociationApi association;

  FacilityCrmDoctor toDomain() {
    final name = professional.fullName?.trim().isNotEmpty == true
        ? professional.fullName!.trim()
        : '${professional.firstName} ${professional.lastName}'.trim();
    final phone = professional.mobilePhone?.trim().isNotEmpty == true
        ? professional.mobilePhone
        : professional.landlinePhone;
    final crm = _formatCrm(professional.crmNumber, professional.crmState);
    return FacilityCrmDoctor(
      id: professional.id,
      name: name,
      initials: initialsFromName(name),
      hue: hueFromName(name),
      specialty: professional.specialty ?? association.specialtyLabel,
      crm: crm,
      phone: phone,
      email: professional.email,
      isPartner: association.isPartner,
      isPrescriber: association.isPrescriber,
      isBuyer: association.isBuyer,
      isDecisionMaker: association.isDecisionMaker,
      roleBadge: association.isDecisionMaker ? 'DECISOR' : null,
      birthdayLabel: _formatBirthday(professional.birthDate),
      favoriteTeam: professional.favoriteTeam,
      interests: professional.hobbies,
      relationshipScore: association.relationshipLevel,
    );
  }
}

class FacilityProfessionalSummaryApi {
  const FacilityProfessionalSummaryApi({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.fullName,
    this.specialty,
    this.crmNumber,
    this.crmState,
    this.mobilePhone,
    this.landlinePhone,
    this.email,
    this.birthDate,
    this.favoriteTeam,
    this.hobbies,
  });

  factory FacilityProfessionalSummaryApi.fromMap(Map<String, dynamic> map) {
    return FacilityProfessionalSummaryApi(
      id: readString(map['id']),
      firstName: readString(map['firstName']),
      lastName: readString(map['lastName']),
      fullName: readNullableString(map['fullName']),
      specialty: readNullableString(map['specialty']),
      crmNumber: readNullableString(map['crmNumber']),
      crmState: readNullableString(map['crmState']),
      mobilePhone: readNullableString(map['mobilePhone']),
      landlinePhone: readNullableString(map['landlinePhone']),
      email: readNullableString(map['email']),
      birthDate: readNullableDateTime(map['birthDate']),
      favoriteTeam: readNullableString(map['favoriteTeam']),
      hobbies: readNullableString(map['hobbies']),
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
  final String? hobbies;
}

class FacilityProfessionalAssociationApi {
  const FacilityProfessionalAssociationApi({
    required this.isPartner,
    required this.isPrescriber,
    required this.isBuyer,
    required this.isDecisionMaker,
    this.specialtyLabel,
    this.relationshipLevel,
  });

  factory FacilityProfessionalAssociationApi.fromMap(Map<String, dynamic> map) {
    return FacilityProfessionalAssociationApi(
      isPartner: map['isPartner'] == true,
      isPrescriber: map['isPrescriber'] == true,
      isBuyer: map['isBuyer'] == true,
      isDecisionMaker: map['isDecisionMaker'] == true,
      specialtyLabel: readNullableString(map['specialtyLabel']),
      relationshipLevel: _readLevel(map['relationshipLevel']),
    );
  }

  final bool isPartner;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;
  final String? specialtyLabel;

  /// Viewer × professional (1–10). Drives Relacionamento stars on mobile.
  final int? relationshipLevel;
}

class PaginatedFacilityProfessionals {
  const PaginatedFacilityProfessionals({
    required this.items,
    required this.pagination,
  });

  factory PaginatedFacilityProfessionals.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedFacilityProfessionals.fromMap(decoded);
  }

  factory PaginatedFacilityProfessionals.fromMap(Map<String, dynamic> map) {
    return PaginatedFacilityProfessionals(
      items: readObjectList(
        map['data'],
      ).map(FacilityProfessionalListItemApi.fromMap).toList(growable: false),
      pagination: Pagination.fromMap(
        (map['pagination'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  final List<FacilityProfessionalListItemApi> items;
  final Pagination pagination;
}

int? _readLevel(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

String? _formatCrm(String? number, String? state) {
  final n = number?.trim();
  if (n == null || n.isEmpty) return null;
  final s = state?.trim();
  if (s == null || s.isEmpty) return 'CRM $n';
  return 'CRM/$s $n';
}

String? _formatBirthday(DateTime? date) {
  if (date == null) return null;
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return '${date.day.toString().padLeft(2, '0')}/${months[date.month - 1]}';
}

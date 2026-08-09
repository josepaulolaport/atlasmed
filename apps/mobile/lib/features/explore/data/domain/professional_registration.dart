import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Council catalog row — `GET /person-professional-registration-councils`.
class ProfessionalRegistrationCouncil {
  const ProfessionalRegistrationCouncil({
    required this.id,
    required this.name,
    required this.abbreviation,
    this.isActive = true,
  });

  factory ProfessionalRegistrationCouncil.fromMap(Map<String, dynamic> map) {
    return ProfessionalRegistrationCouncil(
      id: readCrmId(map['id'], 'id'),
      name: readString(map['name']),
      abbreviation: readString(map['abbreviation']),
      isActive: map['isActive'] != false,
    );
  }

  final int id;
  final String name;
  final String abbreviation;
  final bool isActive;
}

/// Person professional registration — nested under `/persons/:id`.
class ProfessionalRegistration {
  const ProfessionalRegistration({
    required this.id,
    required this.personId,
    required this.councilId,
    required this.councilAbbreviation,
    required this.councilName,
    required this.stateCode,
    required this.registrationNumber,
    required this.isPrimary,
    required this.isActive,
  });

  factory ProfessionalRegistration.fromMap(Map<String, dynamic> map) {
    return ProfessionalRegistration(
      id: readCrmId(map['id'], 'id'),
      personId: readCrmId(map['personId'], 'personId'),
      councilId: readCrmId(map['councilId'], 'councilId'),
      councilAbbreviation: readString(map['councilAbbreviation']),
      councilName: readString(map['councilName']),
      stateCode: readString(map['stateCode']),
      registrationNumber: readString(map['registrationNumber']),
      isPrimary: map['isPrimary'] == true,
      isActive: map['isActive'] != false,
    );
  }

  final int id;
  final int personId;
  final int councilId;
  final String councilAbbreviation;
  final String councilName;
  final String stateCode;
  final String registrationNumber;
  final bool isPrimary;
  final bool isActive;

  String get displayLabel =>
      '$councilAbbreviation/$stateCode $registrationNumber';
}

/// Brazilian UF codes for registration forms.
const kBrazilUfCodes = <String>[
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

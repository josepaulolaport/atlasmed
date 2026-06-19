import '../clinic_detail.dart';
import '../doctor_detail.dart';
import '../models.dart';

const _lowerParticles = {'da', 'de', 'do', 'dos', 'das', 'e'};

String formatDisplayName(String? value) {
  if (value == null || value.trim().isEmpty) return '—';

  final trimmed = value.trim();
  final letters = trimmed.replaceAll(RegExp(r'[^A-Za-zÀ-ÿ]'), '');
  final isMostlyUpper =
      letters.isNotEmpty && letters == letters.toUpperCase() && trimmed.length > 3;

  if (!isMostlyUpper) return trimmed;

  return trimmed.split(RegExp(r'\s+')).asMap().entries.map((entry) {
    final index = entry.key;
    final word = entry.value;
    if (word.isEmpty) return word;

    final lower = word.toLowerCase();
    if (index > 0 && _lowerParticles.contains(lower)) return lower;

    if (word.length <= 2 && word == word.toUpperCase()) return word;

    return lower[0].toUpperCase() + lower.substring(1);
  }).join(' ');
}

String formatOccupationLabel(String? value) {
  if (value == null || value.trim().isEmpty) return '—';
  if (RegExp(r'^\d+[A-Z0-9]*$').hasMatch(value.trim())) {
    return value.trim();
  }
  return formatDisplayName(value);
}

String readOccupationLabel(Map<String, dynamic> json, {String? codeField}) {
  final name = readField(json, 'occupationName', 'occupation_name');
  if (name != null) return formatDisplayName(name);

  final labels = readField(json, 'occupationLabels', 'occupation_labels');
  if (labels != null) return firstToken(labels);

  return formatOccupationLabel(
    codeField ?? readField(json, 'occupationCode', 'occupation_code'),
  );
}

String initialsFromName(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}

double hueFromId(String id) => id.hashCode.abs() % 360.0;

String firstToken(String? value) {
  if (value == null || value.trim().isEmpty) return '—';
  return formatDisplayName(value.split(',').first.trim());
}

String? formatLicenseLabel({
  String? licenseLabel,
  String? councilCode,
  String? councilName,
  String? licenseState,
  String? licenseNumber,
}) {
  if (licenseLabel != null && licenseLabel.trim().isNotEmpty) {
    return licenseLabel.trim();
  }

  final number = licenseNumber?.replaceAll(RegExp(r'''^['"]+|['"]+$'''), '').trim();
  if (number == null || number.isEmpty) return null;

  final formattedNumber = RegExp(r'^\d+[A-Za-z]$').hasMatch(number)
      ? '${number.substring(0, number.length - 1)}-${number.substring(number.length - 1).toUpperCase()}'
      : number;

  final acronym = _resolveCouncilAcronym(councilCode, councilName);
  final state = licenseState?.trim();
  if (acronym != null && state != null && state.isNotEmpty) {
    return '$acronym-$state $formattedNumber';
  }
  if (acronym != null) return '$acronym $formattedNumber';
  return formattedNumber;
}

String? readLicenseLabel(Map<String, dynamic> json) {
  return formatLicenseLabel(
    licenseLabel: readField(json, 'licenseLabel', 'license_label'),
    councilCode: readField(json, 'councilCode', 'council_code'),
    councilName: readField(json, 'councilName', 'council_name'),
    licenseState: readField(json, 'licenseState', 'license_state'),
    licenseNumber: readField(json, 'licenseNumber', 'license_number'),
  );
}

String? _resolveCouncilAcronym(String? councilCode, String? councilName) {
  const acronyms = {
    '66': 'COREN',
    '70': 'CREFITO',
    '71': 'CRM',
    '69': 'CRF',
    '74': 'CRN',
    '75': 'CRO',
    '77': 'CRP',
    '17': 'CRFa',
    '15': 'CRBM',
    '19': 'CREF',
  };

  final code = councilCode?.trim();
  if (code != null && acronyms.containsKey(code)) {
    return acronyms[code];
  }

  final name = councilName?.trim().toLowerCase();
  if (name == null || name.isEmpty) return code;

  if (name.contains('medicina') && !name.contains('veterinaria')) return 'CRM';
  if (name.contains('fisioterapia') || name.contains('terapia ocup')) {
    return 'CREFITO';
  }
  if (name.contains('enfermagem')) return 'COREN';
  if (name.contains('odontologia')) return 'CRO';
  if (name.contains('psicologia')) return 'CRP';
  if (name.contains('nutricao')) return 'CRN';
  if (name.contains('farmacia')) return 'CRF';

  return code;
}

@Deprecated('Use formatLicenseLabel or readLicenseLabel')
String? formatCrm(String? councilCode, String? licenseNumber) {
  return formatLicenseLabel(
    councilCode: councilCode,
    licenseNumber: licenseNumber,
  );
}

ClinicStatus statusFromActive(bool isActive) =>
    isActive ? ClinicStatus.ativa : ClinicStatus.inativa;

List<Map<String, dynamic>> readObjectList(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

String? readField(Map<String, dynamic> json, String camel, String snake) {
  final value = json[camel] ?? json[snake];
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

Clinic mapFacilityToClinic(Map<String, dynamic> json) {
  final isActive = json['isActive'] == true;
  final rawName = (json['tradeName'] ?? json['legalName'] ?? '—').toString();

  return Clinic(
    id: json['facilityId'].toString(),
    name: formatDisplayName(rawName),
    city: formatDisplayName(json['municipalityName']?.toString() ?? ''),
    neighborhood: formatDisplayName(json['neighborhood']?.toString() ?? ''),
    distanceKm: 0,
    status: statusFromActive(isActive),
    lastVisitDays: null,
    doctorCount: (json['professionalCount'] as num?)?.toInt() ?? 0,
    isPriority: false,
    products: const [],
    cnesCode: json['cnesCode']?.toString(),
    legalName: json['legalName'] != null ? formatDisplayName(json['legalName'].toString()) : null,
    fullAddress: json['fullAddress']?.toString(),
    postalCode: json['postalCode']?.toString(),
    stateCode: json['stateCode']?.toString(),
    stateName: json['stateName'] != null ? formatDisplayName(json['stateName'].toString()) : null,
    latitude: (json['latitude'] as num?)?.toDouble(),
    longitude: (json['longitude'] as num?)?.toDouble(),
    phone: json['phoneNumber']?.toString(),
    email: json['email']?.toString(),
    websiteUrl: json['websiteUrl']?.toString(),
    facilityType: json['facilityType'] != null ? formatDisplayName(json['facilityType'].toString()) : null,
    facilityTypeCode: json['facilityTypeCode']?.toString(),
    unitTypeName: json['unitTypeName'] != null ? formatDisplayName(json['unitTypeName'].toString()) : null,
    unitSubtypeName:
        json['unitSubtypeName'] != null ? formatDisplayName(json['unitSubtypeName'].toString()) : null,
    isActive: isActive,
  );
}

ClinicDetail mapFacilityToClinicDetail(Map<String, dynamic> json) {
  final clinic = mapFacilityToClinic(json);
  final professionals = readObjectList(json['professionals']);

  return ClinicDetail(
    id: clinic.id,
    name: clinic.name,
    city: clinic.city,
    neighborhood: clinic.neighborhood,
    distanceKm: clinic.distanceKm,
    status: clinic.status,
    lastVisitDays: clinic.lastVisitDays,
    doctorCount: professionals.isNotEmpty ? professionals.length : clinic.doctorCount,
    isPriority: clinic.isPriority,
    products: clinic.products,
    phone: clinic.phone,
    email: clinic.email,
    website: clinic.websiteUrl,
    streetAddress: clinic.fullAddress,
    cnpj: json['taxIdCnpj']?.toString(),
    region: clinic.stateName,
    clientType: clinic.facilityType,
    segment: clinic.unitTypeName,
    registeredSince: json['createdAt'] != null
        ? DateTime.tryParse(json['createdAt'].toString())
        : null,
    clinicDoctors: professionals
        .map(
          (p) {
            final name = formatDisplayName(
              readField(p, 'fullName', 'full_name') ?? '—',
            );
            final id = readField(p, 'professionalId', 'professional_id') ?? '';
            return DoctorInfo(
              id: id,
              name: name,
              initials: initialsFromName(name),
              hue: hueFromId(id),
              specialty: readOccupationLabel(p),
              crm: readLicenseLabel(p),
            );
          },
        )
        .toList(),
  );
}

Doctor mapProfessionalToDoctor(Map<String, dynamic> json) {
  final id = json['professionalId'].toString();
  final name = formatDisplayName(json['fullName'].toString());

  return Doctor(
    id: id,
    name: name,
    initials: initialsFromName(name),
    hue: hueFromId(id),
    specialty: firstToken(
      readField(json, 'occupationLabels', 'occupation_labels') ??
          json['occupationCodes']?.toString(),
    ),
    primaryClinic: firstToken(json['currentFacilities']?.toString()),
    crm: readField(json, 'licenses', 'licenses') ?? '',
    distanceKm: 0,
    isPriority: false,
    socialName: json['socialName'] != null ? formatDisplayName(json['socialName'].toString()) : null,
    activeFacilitiesCount: (json['activeFacilitiesCount'] as num?)?.toInt() ?? 0,
    currentFacilities: json['currentFacilities'] != null
        ? formatDisplayName(json['currentFacilities'].toString())
        : null,
    currentLocations: json['currentLocations']?.toString(),
    licenses: json['licenses']?.toString(),
    councils: json['councils']?.toString(),
    occupationCodes: json['occupationCodes']?.toString(),
    activePositions: (json['activePositions'] as num?)?.toInt() ?? 0,
    totalWeeklyHours: (json['totalWeeklyHours'] as num?)?.toInt(),
    isPreceptor: json['isPreceptor'] == true,
    isResident: json['isResident'] == true,
  );
}

DoctorDetail mapProfessionalToDoctorDetail(Map<String, dynamic> json) {
  final doctor = mapProfessionalToDoctor(json);
  final links = readObjectList(json['facilityLinks'] ?? json['facility_links']);

  return DoctorDetail(
    id: doctor.id,
    name: doctor.name,
    initials: doctor.initials,
    hue: doctor.hue,
    specialty: doctor.specialty,
    crm: doctor.crm,
    role: readField(json, 'occupationLabels', 'occupation_labels') ??
        doctor.occupationCodes ??
        doctor.specialty,
    distanceKm: doctor.distanceKm,
    team: doctor.currentFacilities,
    clinics: links.asMap().entries.map(
          (entry) {
            final link = entry.value;
            final facilityName = formatDisplayName(
              readField(link, 'tradeName', 'trade_name') ??
                  readField(link, 'municipalityName', 'municipality_name') ??
                  '—',
            );
            return DoctorClinic(
              id: readField(link, 'facilityId', 'facility_id') ?? '',
              name: facilityName,
              role: readOccupationLabel(link),
              days: link['weeklyHoursAmbulatory'] != null ||
                      link['weekly_hours_ambulatory'] != null
                  ? '${link['weeklyHoursAmbulatory'] ?? link['weekly_hours_ambulatory']}h/sem'
                  : '—',
              isMain: entry.key == 0,
            );
          },
        )
        .toList(),
  );
}

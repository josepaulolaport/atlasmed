import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/mappers/explore_mapper.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models.dart';

void main() {
  group('explore_mapper', () {
    test('initialsFromName handles multi-word names', () {
      expect(initialsFromName('Ana Beatriz Oliveira'), 'AO');
      expect(initialsFromName('João'), 'J');
    });

    test('mapFacilityToClinic maps DB fields and mocks CRM gaps', () {
      final clinic = mapFacilityToClinic({
        'facilityId': '3550309810781',
        'cnesCode': '9810781',
        'tradeName': 'HOSPITAL SAMARITANO',
        'legalName': 'HOSPITAL SAMARITANO SA',
        'municipalityName': 'SAO PAULO',
        'neighborhood': 'BELA VISTA',
        'latitude': -23.55,
        'longitude': -46.63,
        'phoneNumber': '2126225391',
        'facilityType': 'HOSPITAL GERAL',
        'professionalCount': 12,
        'isActive': true,
      });

      expect(clinic.id, '3550309810781');
      expect(clinic.cnesCode, '9810781');
      expect(clinic.name, 'Hospital Samaritano');
      expect(clinic.city, 'Sao Paulo');
      expect(clinic.doctorCount, 12);
      expect(clinic.status, ClinicStatus.ativa);
      expect(clinic.distanceKm, 0);
      expect(clinic.isPriority, false);
      expect(clinic.products, isEmpty);
    });

    test('mapFacilityToClinicDetail maps linked professionals', () {
      final detail = mapFacilityToClinicDetail({
        'facilityId': 'f1',
        'tradeName': 'Clinica Teste',
        'municipalityName': 'Curitiba',
        'neighborhood': 'Centro',
        'isActive': true,
        'professionalCount': 1,
        'taxIdCnpj': '12345678000199',
        'professionals': [
          {
            'professionalId': 'p1',
            'fullName': 'Maria Silva',
            'occupationCode': '225125',
            'occupationName': 'Médico clínico',
            'councilCode': '71',
            'councilName': 'medicina conselho regional',
            'licenseState': 'SP',
            'licenseNumber': '123456',
            'licenseLabel': 'CRM-SP 123456',
          },
        ],
      });

      expect(detail.cnpj, '12345678000199');
      expect(detail.clinicDoctors, hasLength(1));
      expect(detail.clinicDoctors.first.name, 'Maria Silva');
      expect(detail.clinicDoctors.first.initials, 'MS');
      expect(detail.clinicDoctors.first.specialty, 'Médico clínico');
      expect(detail.clinicDoctors.first.crm, 'CRM-SP 123456');
    });

    test('mapProfessionalToDoctor maps licenses and occupation labels', () {
      final doctor = mapProfessionalToDoctor({
        'professionalId': 'p99',
        'fullName': 'Carlos Eduardo Lima',
        'occupationCodes': '225125, 2231',
        'occupationLabels': 'Médico clínico, Enfermeiro',
        'currentFacilities': 'Hospital A, Hospital B',
        'licenses': 'CRM-SP 123456',
        'activeFacilitiesCount': 2,
        'isPreceptor': true,
        'isResident': false,
      });

      expect(doctor.id, 'p99');
      expect(doctor.specialty, 'Médico clínico');
      expect(doctor.primaryClinic, 'Hospital A');
      expect(doctor.crm, 'CRM-SP 123456');
      expect(doctor.activeFacilitiesCount, 2);
      expect(doctor.isPreceptor, true);
      expect(doctor.isPriority, false);
    });

    test('mapProfessionalToDoctorDetail maps facility links', () {
      final detail = mapProfessionalToDoctorDetail({
        'professionalId': 'p1',
        'fullName': 'Maria Silva',
        'occupationCodes': '225125',
        'occupationLabels': 'Médico clínico',
        'licenses': '66: 999',
        'facilityLinks': [
          {
            'facilityId': 'f1',
            'tradeName': 'Clinica Norte',
            'occupationCode': '225125',
            'occupationName': 'Médico clínico',
            'weeklyHoursAmbulatory': 20,
          },
        ],
      });

      expect(detail.clinics, hasLength(1));
      expect(detail.clinics.first.name, 'Clinica Norte');
      expect(detail.clinics.first.role, 'Médico clínico');
      expect(detail.clinics.first.days, '20h/sem');
      expect(detail.clinics.first.isMain, true);
    });
  });
}

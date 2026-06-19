import 'package:flutter/material.dart';

// ── Clinic status ────────────────────────────────────────────
enum ClinicStatus { ativa, negociacao, inativa, nunca, rejeicao }

extension ClinicStatusX on ClinicStatus {
  String get label {
    switch (this) {
      case ClinicStatus.ativa:
        return 'Ativa';
      case ClinicStatus.negociacao:
        return 'Em negociação';
      case ClinicStatus.inativa:
        return 'Inativa';
      case ClinicStatus.nunca:
        return 'Nunca comprou';
      case ClinicStatus.rejeicao:
        return 'Rejeição';
    }
  }

  Color get color {
    switch (this) {
      case ClinicStatus.ativa:
        return const Color(0xFF16a373);
      case ClinicStatus.negociacao:
        return const Color(0xFFc6861b);
      case ClinicStatus.inativa:
        return const Color(0xFF6b7280);
      case ClinicStatus.nunca:
        return const Color(0xFF3b82f6);
      case ClinicStatus.rejeicao:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case ClinicStatus.ativa:
        return const Color(0xFFe6f7f0);
      case ClinicStatus.negociacao:
        return const Color(0xFFfef3d5);
      case ClinicStatus.inativa:
        return const Color(0xFFf3f4f6);
      case ClinicStatus.nunca:
        return const Color(0xFFeef4ff);
      case ClinicStatus.rejeicao:
        return const Color(0xFFfde8e8);
    }
  }
}

// ── Clinic model ─────────────────────────────────────────────
class Clinic {
  final String id;
  final String name;
  final String city;
  final String neighborhood;
  final double distanceKm;
  final ClinicStatus status;
  final int? lastVisitDays;
  final int doctorCount;
  final bool isPriority;
  final List<String> products;

  // DB-backed (mcp_test)
  final String? cnesCode;
  final String? legalName;
  final String? fullAddress;
  final String? postalCode;
  final String? stateCode;
  final String? stateName;
  final double? latitude;
  final double? longitude;
  final String? phone;
  final String? email;
  final String? websiteUrl;
  final String? facilityType;
  final String? facilityTypeCode;
  final String? unitTypeName;
  final String? unitSubtypeName;
  final bool isActive;

  const Clinic({
    required this.id,
    required this.name,
    required this.city,
    required this.neighborhood,
    required this.distanceKm,
    required this.status,
    required this.lastVisitDays,
    required this.doctorCount,
    required this.isPriority,
    required this.products,
    this.cnesCode,
    this.legalName,
    this.fullAddress,
    this.postalCode,
    this.stateCode,
    this.stateName,
    this.latitude,
    this.longitude,
    this.phone,
    this.email,
    this.websiteUrl,
    this.facilityType,
    this.facilityTypeCode,
    this.unitTypeName,
    this.unitSubtypeName,
    this.isActive = true,
  });
}

// ── Doctor model ─────────────────────────────────────────────
class Doctor {
  final String id;
  final String name;
  final String initials;
  final double hue;
  final String specialty;
  final String primaryClinic;
  final String crm;
  final double distanceKm;
  final bool isPriority;

  // DB-backed (mcp_test)
  final String? socialName;
  final int activeFacilitiesCount;
  final String? currentFacilities;
  final String? currentLocations;
  final String? licenses;
  final String? councils;
  final String? occupationCodes;
  final int activePositions;
  final int? totalWeeklyHours;
  final bool isPreceptor;
  final bool isResident;

  const Doctor({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    required this.specialty,
    required this.primaryClinic,
    required this.crm,
    required this.distanceKm,
    required this.isPriority,
    this.socialName,
    this.activeFacilitiesCount = 0,
    this.currentFacilities,
    this.currentLocations,
    this.licenses,
    this.councils,
    this.occupationCodes,
    this.activePositions = 0,
    this.totalWeeklyHours,
    this.isPreceptor = false,
    this.isResident = false,
  });
}

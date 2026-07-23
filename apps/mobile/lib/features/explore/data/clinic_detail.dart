import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/visit_type.dart';

// ── Clinic detail model ───────────────────────────────────────
//
// Identity + contact fields for the establishment. Section-specific data
// (payers, doctors, signals, products, notes, nearby establishments) lives
// in `EstablishmentDetailSections` (see establishment_detail_models.dart)
// instead of here — that model is the single source of truth for the
// detail screen sections and is what gets wired to real endpoints in
// Phase 2/3 of Spec 0005.

class ClinicDetail {
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

  // Additional detail fields
  final String? phone;
  final String? whatsapp;
  final String? consultantName;
  final DateTime? consultantSince;
  final String? managerName;
  final String? territoryName;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;
  final String? postalCode;
  final String? state;
  final double? lat;
  final double? lng;

  // Admin info
  final String? taxIdType;
  final String? cnpj;
  final String? cpf;
  final String? email;
  final String? billingEmail;
  final String? website;
  final String? responsibleDoctor;
  final String? openingHours;
  final DateTime? registeredSince;
  final String? commercialStatus;
  final String? conformityStatus;

  const ClinicDetail({
    required this.id,
    required this.name,
    required this.city,
    required this.neighborhood,
    required this.distanceKm,
    required this.status,
    this.lastVisitDays,
    required this.doctorCount,
    required this.isPriority,
    required this.products,
    this.phone,
    this.whatsapp,
    this.consultantName,
    this.consultantSince,
    this.managerName,
    this.territoryName,
    this.streetAddress,
    this.streetNumber,
    this.addressComplement,
    this.postalCode,
    this.state,
    this.lat,
    this.lng,
    this.taxIdType,
    this.cnpj,
    this.cpf,
    this.email,
    this.billingEmail,
    this.website,
    this.responsibleDoctor,
    this.openingHours,
    this.registeredSince,
    this.commercialStatus,
    this.conformityStatus,
  });

  /// Neighbourhood + street + number + complement as one line for "Endereço".
  String? get composedAddressLine {
    final streetParts = <String>[];
    final street = streetAddress?.trim();
    final number = streetNumber?.trim();
    if (street != null && street.isNotEmpty) {
      streetParts.add(
        number != null && number.isNotEmpty ? '$street, $number' : street,
      );
    } else if (number != null && number.isNotEmpty) {
      streetParts.add(number);
    }
    final complement = addressComplement?.trim();
    if (complement != null && complement.isNotEmpty) {
      streetParts.add(complement);
    }
    final hood = neighborhood.trim();
    final line = <String>[
      if (hood.isNotEmpty) hood,
      if (streetParts.isNotEmpty) streetParts.join(' · '),
    ].join(' · ');
    return line.isEmpty ? null : line;
  }

  /// Full address for header / maps — street line plus city/state when present.
  String? get formattedAddress {
    final parts = <String>[
      ?composedAddressLine,
      if (city.trim().isNotEmpty) city.trim(),
      if (state != null && state!.trim().isNotEmpty) state!.trim(),
    ];
    return parts.isEmpty ? null : parts.join(' — ');
  }
}

// ── Sub-models ────────────────────────────────────────────────

class ClinicVisit {
  final String id;
  final DateTime date;
  final VisitType type;
  final String? summary;

  const ClinicVisit({
    required this.id,
    required this.date,
    required this.type,
    this.summary,
  });

  factory ClinicVisit.fromJson(Map<String, dynamic> json) {
    return ClinicVisit(
      id: json['id'] as String,
      date: DateTime.parse(json['visitedAt'] as String),
      type: visitTypeFromJson(json['type'] as String? ?? 'visit'),
      summary: json['summary'] as String?,
    );
  }
}

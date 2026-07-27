import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/visit_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;

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
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;

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
    this.purchaseRecurrence,
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

  /// Maps an [api.Clinic] from the detail endpoint into a [ClinicDetail].
  factory ClinicDetail.fromApi(api.Clinic apiClinic) {
    String? nonEmpty(String? value) {
      final trimmed = value?.trim();
      return trimmed == null || trimmed.isEmpty ? null : trimmed;
    }

    return ClinicDetail(
      id: apiClinic.id,
      name: apiClinic.name,
      city: nonEmpty(apiClinic.city) ?? '',
      state: nonEmpty(apiClinic.state),
      neighborhood: nonEmpty(apiClinic.neighborhood) ?? '',
      distanceKm: apiClinic.distanceKm ?? 0,
      status: ClinicStatus.active,
      lastVisitDays: null,
      doctorCount: apiClinic.professionalCount,
      isPriority: false,
      products: [],
      phone: nonEmpty(apiClinic.phone),
      whatsapp: nonEmpty(apiClinic.whatsapp),
      consultantName: apiClinic.consultantName,
      consultantSince: apiClinic.consultantSince,
      managerName: apiClinic.managerName,
      territoryName: apiClinic.territoryName,
      email: nonEmpty(apiClinic.email),
      billingEmail: nonEmpty(apiClinic.billingEmail),
      website: nonEmpty(apiClinic.website),
      responsibleDoctor: nonEmpty(apiClinic.responsibleName),
      openingHours: nonEmpty(apiClinic.openingHours),
      registeredSince: apiClinic.registeredSince ?? apiClinic.createdAt,
      streetAddress: nonEmpty(apiClinic.streetAddress),
      streetNumber: nonEmpty(apiClinic.streetNumber),
      addressComplement: nonEmpty(apiClinic.addressComplement),
      postalCode: nonEmpty(apiClinic.postalCode),
      lat: apiClinic.lat,
      lng: apiClinic.lng,
      taxIdType: apiClinic.taxIdType,
      cnpj: apiClinic.cnpj,
      cpf: apiClinic.cpf,
      commercialStatus: apiClinic.commercialStatus,
      conformityStatus: apiClinic.conformityStatus,
      purchaseRecurrence: apiClinic.purchaseRecurrence,
    );
  }

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

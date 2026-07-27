import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

// ═══════════════════════════════════════════════════════════════
// Facility — modelo completo para o detail screen
// ═══════════════════════════════════════════════════════════════

class Facility {
  final String id;
  final String name;

  // Subtipos agrupando campos relacionados
  final FacilityAddress? address;
  final FacilityContact? contact;
  final FacilityCommercial? commercial;
  final FacilityTerritory? territory;
  final FacilityRegistration? registration;

  // Campos soltos
  final double? distanceKm;
  final PurchaseRecurrenceSnapshot? purchaseRecurrence;
  final int professionalCount;
  final String? imageUrl;
  final List<ClinicService> services;
  final String? createdAt;
  final String? updatedAt;

  const Facility({
    required this.id,
    required this.name,
    this.address,
    this.contact,
    this.commercial,
    this.territory,
    this.registration,
    this.distanceKm,
    this.purchaseRecurrence,
    this.professionalCount = 0,
    this.imageUrl,
    this.services = const [],
    this.createdAt,
    this.updatedAt,
  });

  /// Apenas o básico — a partir do DTO do detail.
  /// Copia a lógica do antigo [ClinicDetail.fromApi].
  factory Facility.fromDTO(FacilityDTO dto) {
    String? nonEmpty(String? value) {
      final trimmed = value?.trim();
      return trimmed == null || trimmed.isEmpty ? null : trimmed;
    }

    final city = nonEmpty(dto.city) ?? '';
    final neighborhood = nonEmpty(dto.neighborhood) ?? '';

    return Facility(
      id: dto.id,
      name: dto.name,
      address: FacilityAddress(
        streetAddress: nonEmpty(dto.streetAddress),
        streetNumber: nonEmpty(dto.streetNumber),
        addressComplement: nonEmpty(dto.addressComplement),
        neighborhood: neighborhood,
        city: city,
        state: nonEmpty(dto.state),
        postalCode: nonEmpty(dto.postalCode),
        lat: dto.lat,
        lng: dto.lng,
      ),
      contact: FacilityContact(
        phone: nonEmpty(dto.phone),
        whatsapp: nonEmpty(dto.whatsapp),
        email: nonEmpty(dto.email),
        website: nonEmpty(dto.website),
        billingEmail: nonEmpty(dto.billingEmail),
      ),
      commercial: FacilityCommercial(
        commercialStatus: dto.commercialStatus,
        conformityStatus: dto.conformityStatus,
        doctorCount: dto.professionalCount,
      ),
      territory: FacilityTerritory(
        consultantName: dto.consultantName,
        consultantSince: dto.consultantSince != null
            ? DateTime.tryParse(dto.consultantSince!)
            : null,
        managerName: dto.managerName,
        territoryName: dto.territoryName,
      ),
      registration: FacilityRegistration(
        taxIdType: dto.taxIdType,
        cnpj: dto.cnpj,
        cpf: dto.cpf,
        responsiblePerson: nonEmpty(dto.responsibleName),
        openingHours: nonEmpty(dto.openingHours),
        registeredSince: dto.registeredSince != null
            ? DateTime.tryParse(dto.registeredSince!)
            : (dto.createdAt != null
                  ? DateTime.tryParse(dto.createdAt!)
                  : null),
      ),
      distanceKm: dto.distanceKm,
      purchaseRecurrence: dto.purchaseRecurrence,
      professionalCount: dto.professionalCount,
      imageUrl: dto.imageUrl,
      services: dto.services,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Sub-tipos
// ═══════════════════════════════════════════════════════════════

class FacilityAddress {
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;
  final String? neighborhood;
  final String city;
  final String? state;
  final String? postalCode;
  final double? lat;
  final double? lng;

  const FacilityAddress({
    this.streetAddress,
    this.streetNumber,
    this.addressComplement,
    this.neighborhood,
    this.city = '',
    this.state,
    this.postalCode,
    this.lat,
    this.lng,
  });

  /// Bairro + rua + número + complemento como uma linha para "Endereço".
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
    final hood = neighborhood?.trim() ?? '';
    final line = <String>[
      if (hood.isNotEmpty) hood,
      if (streetParts.isNotEmpty) streetParts.join(' · '),
    ].join(' · ');
    return line.isEmpty ? null : line;
  }

  /// Endereço completo para o header/maps — linha de rua + cidade/estado.
  String? get formattedAddress {
    final parts = <String>[
      ?composedAddressLine,
      if (city.trim().isNotEmpty) city.trim(),
      if (state != null && state!.trim().isNotEmpty) state!.trim(),
    ];
    return parts.isEmpty ? null : parts.join(' — ');
  }
}

class FacilityContact {
  final String? phone;
  final String? whatsapp;
  final String? email;
  final String? website;
  final String? billingEmail;

  const FacilityContact({
    this.phone,
    this.whatsapp,
    this.email,
    this.website,
    this.billingEmail,
  });
}

class FacilityCommercial {
  final String? commercialStatus;
  final String? conformityStatus;
  final int doctorCount;

  const FacilityCommercial({
    this.commercialStatus,
    this.conformityStatus,
    this.doctorCount = 0,
  });
}

class FacilityTerritory {
  final String? consultantName;
  final DateTime? consultantSince;
  final String? managerName;
  final String? territoryName;

  const FacilityTerritory({
    this.consultantName,
    this.consultantSince,
    this.managerName,
    this.territoryName,
  });
}

class FacilityRegistration {
  final String? taxIdType;
  final String? cnpj;
  final String? cpf;
  final String? responsiblePerson;
  final String? openingHours;
  final DateTime? registeredSince;

  const FacilityRegistration({
    this.taxIdType,
    this.cnpj,
    this.cpf,
    this.responsiblePerson,
    this.openingHours,
    this.registeredSince,
  });
}

// VisitTimeline mantido em establishment_detail_models.dart (integração)

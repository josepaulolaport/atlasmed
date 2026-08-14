import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:flutter/painting.dart';

// ═══════════════════════════════════════════════════════════════
// Facility — modelo completo para o detail screen
// ═══════════════════════════════════════════════════════════════

class Facility {
  /// Whether the caller has this clinic in Favoritos (detail responses only).
  final bool isBookmarked;

  final int id;
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
  final String? imageBlurhash;
  final List<ClinicalFocus> clinicalFocuses;
  final List<FacilityVerticalProfileDTO> verticalProfiles;
  final String? createdAt;
  final String? updatedAt;

  const Facility({
    this.isBookmarked = false,
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
    this.imageBlurhash,
    this.clinicalFocuses = const [],
    this.verticalProfiles = const [],
    this.createdAt,
    this.updatedAt,
  });

  /// Apenas o básico — a partir do DTO do detail.
  /// Copia a lógica do antigo [ClinicDetail.fromApi].
  factory Facility.fromDTO(FacilityDTO dto, {int? verticalId}) {
    String? nonEmpty(String? value) {
      final trimmed = value?.trim();
      return trimmed == null || trimmed.isEmpty ? null : trimmed;
    }

    final city = nonEmpty(dto.city) ?? '';
    final neighborhood = nonEmpty(dto.neighborhood) ?? '';
    final profile = pickVerticalProfile(
      dto.verticalProfiles,
      verticalId: verticalId,
    );

    return Facility(
      isBookmarked: dto.isBookmarked,
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
        commercialStatus: profile?.commercialStatus,
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
        legalDocumentType: dto.legalDocumentType,
        legalDocument: dto.legalDocument,
        responsiblePerson: nonEmpty(dto.responsibleName),
        openingHours: nonEmpty(dto.openingHours),
        registeredSince: dto.registeredSince != null
            ? DateTime.tryParse(dto.registeredSince!)
            : (dto.createdAt != null
                  ? DateTime.tryParse(dto.createdAt!)
                  : null),
      ),
      distanceKm: dto.distanceKm,
      purchaseRecurrence: profile?.purchaseRecurrence,
      professionalCount: dto.professionalCount,
      imageUrl: dto.imageUrl,
      imageBlurhash: dto.imageBlurhash,
      clinicalFocuses: dto.clinicalFocuses,
      verticalProfiles: dto.verticalProfiles,
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

  /// Parsed status label from the raw [commercialStatus] string.
  /// Falls back to a default label when null.
  StatusLabel get statusLabel {
    return switch (commercialStatus?.toUpperCase()) {
      'UNREGISTERED' => StatusLabel('Pré-cadastro', const Color(0xFF4B5563)),
      'REGISTERED' => StatusLabel('Operante', const Color(0xFF16a373)),
      'SUSPENDED' => StatusLabel('Suspensa', const Color(0xFFc6861b)),
      'CLOSED' => StatusLabel('Encerrada', const Color(0xFF6b7280)),
      _ => StatusLabel('Sem status', const Color(0xFF9ca3af)),
    };
  }
}

/// Small value class for status label + color pairs.
class StatusLabel {
  final String label;
  final Color color;
  const StatusLabel(this.label, this.color);
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
  final String? legalDocumentType;
  final String? legalDocument;
  final String? responsiblePerson;
  final String? openingHours;
  final DateTime? registeredSince;

  const FacilityRegistration({
    this.legalDocumentType,
    this.legalDocument,
    this.responsiblePerson,
    this.openingHours,
    this.registeredSince,
  });
}

// VisitTimeline mantido em establishment_detail_models.dart (integração)

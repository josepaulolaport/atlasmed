import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/interaction_type.dart';

export 'package:atlasmed_mobile_app/features/explore/data/models/interaction_type.dart';

class Interaction {
  final String id;
  final DateTime interactedAt;
  final InteractionType type;
  final String summary;
  final String agentName;

  const Interaction({
    required this.id,
    required this.interactedAt,
    required this.type,
    required this.summary,
    required this.agentName,
  });

  factory Interaction.fromJson(Map<String, dynamic> json) {
    return Interaction(
      id: json['id'] as String,
      interactedAt: DateTime.parse(json['interactedAt'] as String),
      type: interactionTypeFromJson(json['type'] as String),
      summary: json['summary'] as String,
      agentName: json['agentName'] as String,
    );
  }
}

// ── Clinic detail model ───────────────────────────────────────

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
  final String? clientType;
  final String? region;
  final String? streetAddress;

  // Health metrics
  final double? ltv;
  final double? avgTicket;
  final int? avgPurchaseDays;

  // Payers
  final List<PayerInfo> payers;

  // Interaction history
  final List<Interaction> interactions;

  // Doctors at this clinic
  final List<DoctorInfo> clinicDoctors;

  // Notes
  final String? fieldNotes;

  // Admin info
  final String? cnpj;
  final String? email;
  final String? website;
  final String? responsibleDoctor;
  final String? openingHours;
  final DateTime? registeredSince;
  final String? segment;

  // Signals
  final List<ClinicSignal> signals;

  // Nearby clinics
  final List<NearbyClinic> nearbyClinics;

  // Products with trend info
  final List<ProductPerformance> productPerformance;

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
    this.clientType,
    this.region,
    this.streetAddress,
    this.ltv,
    this.avgTicket,
    this.avgPurchaseDays,
    this.payers = const [],
    this.interactions = const [],
    this.clinicDoctors = const [],
    this.fieldNotes,
    this.cnpj,
    this.email,
    this.website,
    this.responsibleDoctor,
    this.openingHours,
    this.registeredSince,
    this.segment,
    this.signals = const [],
    this.nearbyClinics = const [],
    this.productPerformance = const [],
  });
}

// ── Sub-models ────────────────────────────────────────────────

class PayerInfo {
  final String name;
  final double percentage;

  const PayerInfo({required this.name, required this.percentage});
}

class DoctorInfo {
  final String id;
  final String name;
  final String initials;
  final double hue;
  final String? specialty;
  final String? crm;
  final bool isKeyOpinionLeader;
  final bool hasPendingInteraction;

  const DoctorInfo({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    this.specialty,
    this.crm,
    this.isKeyOpinionLeader = false,
    this.hasPendingInteraction = false,
  });
}

class ClinicSignal {
  final String type; // 'warning', 'info', 'success'
  final String message;

  const ClinicSignal({required this.type, required this.message});
}

class NearbyClinic {
  final String id;
  final String name;
  final double distanceKm;

  const NearbyClinic({
    required this.id,
    required this.name,
    required this.distanceKm,
  });
}

class ProductPerformance {
  final String name;
  final String trend; // 'up', 'down', 'stable'
  final double percentageChange;
  final double share; // 0-100

  const ProductPerformance({
    required this.name,
    required this.trend,
    required this.percentageChange,
    required this.share,
  });
}

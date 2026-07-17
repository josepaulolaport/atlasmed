// Domain models for establishment detail sections (Spec 0005).

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';

/// WGS84 coordinates for map sections.
class EstablishmentLocation {
  const EstablishmentLocation({
    required this.latitude,
    required this.longitude,
    this.formattedAddress,
  });

  final double latitude;
  final double longitude;
  final String? formattedAddress;
}

/// CRM row from `facility_representatives`.
class AdministrativeProfessional {
  const AdministrativeProfessional({
    required this.id,
    required this.name,
    this.roleTitle,
    this.email,
    this.phone,
    required this.contactType,
    this.relationshipScore,
  });

  final String id;
  final String name;
  final String? roleTitle;
  final String? email;
  final String? phone;

  /// `PROFESSIONAL`, `DECISOR`, or `COMPRADOR`.
  final String contactType;

  /// Relationship strength, 0-10 scale. Null = not yet determined.
  final int? relationshipScore;

  String get contactTypeLabel {
    switch (contactType) {
      case 'DECISOR':
        return 'Decisor';
      case 'COMPRADOR':
        return 'Comprador';
      default:
        return 'Profissional';
    }
  }
}

/// Confirmed CRM doctor at the establishment.
class FacilityCrmDoctor {
  const FacilityCrmDoctor({
    required this.id,
    required this.name,
    required this.initials,
    required this.hue,
    this.specialty,
    this.crm,
    this.phone,
    this.email,
    this.isPrescriber = false,
    this.isBuyer = false,
    this.isDecisionMaker = false,
    this.roleBadge,
    this.education,
    this.birthdayLabel,
    this.favoriteTeam,
    this.interests,
    this.noteText,
    this.relationshipScore,
  });

  final String id;
  final String name;
  final String initials;
  final double hue;
  final String? specialty;
  final String? crm;

  /// Essential contact fields — mirrors `professionals.phone`/`email`.
  final String? phone;
  final String? email;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;

  /// Small highlight badge, e.g. "DECISORA", "NOVA".
  final String? roleBadge;

  /// "Formação" — no backing field on `professionals` yet.
  final String? education;

  /// "Aniversário" — mirrors `professionals.birthDate` once wired.
  final String? birthdayLabel;

  /// "Time" — mirrors `professionals.favoriteTeam` once wired.
  final String? favoriteTeam;

  /// "Interesses" — mirrors `professionals.hobbies` once wired.
  final String? interests;

  /// Most recent note from `professional_notes`, shown as an amber chip.
  final String? noteText;

  /// Relationship strength, 0-10 scale. Null = not yet determined.
  final int? relationshipScore;
}

/// Healthcare provider share (convênio).
class PayerShare {
  const PayerShare({
    required this.id,
    required this.name,
    required this.sharePercent,
  });

  final String id;
  final String name;
  final double sharePercent;
}

/// Recent order summary for the establishment detail pedidos section.
class FacilityOrderSummary {
  const FacilityOrderSummary({
    required this.id,
    required this.displayId,
    required this.status,
    this.type = 'SALE',
    required this.orderedAt,
    required this.total,
    required this.itemCount,
    this.items = const [],
  });

  final String id;
  final String displayId;
  final String status;

  /// Mirrors `orders.type`: `SALE` | `CONSIGNMENT` | `DONATION` | `OTHER`.
  final String type;
  final DateTime orderedAt;
  final double total;
  final int itemCount;

  /// Line items — mirrors `order_items` (`quantity` × `unit_price`, joined
  /// to `products` for the name). Only populated by `GET /orders/:id` on
  /// the backend today; mocked here so the card can preview them without a
  /// per-order detail fetch. May be shorter than [itemCount] if the caller
  /// only sent a preview slice.
  final List<FacilityOrderItemSummary> items;

  /// Sum of `quantity * unitPrice` across [items] — excludes freight, so it
  /// can differ from [total]. Falls back to [total] when no item lines are
  /// available yet (e.g. mock data that only set the count).
  double get itemsSubtotal => items.isEmpty
      ? total
      : items.fold<double>(0, (sum, i) => sum + i.lineTotal);
}

/// A single order line — mirrors `order_items` joined to `products`.
class FacilityOrderItemSummary {
  const FacilityOrderItemSummary({
    required this.productName,
    required this.quantity,
    required this.unitPrice,
  });

  final String productName;
  final double quantity;
  final double unitPrice;

  double get lineTotal => quantity * unitPrice;
}

/// Another establishment within proximity search.
class NearbyEstablishment {
  const NearbyEstablishment({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.distanceKm,
    this.specialtyLabel,
    this.status = ClinicStatus.active,
    this.neighborhood,
    this.streetAddress,
    this.streetNumber,
    this.addressComplement,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double distanceKm;

  /// e.g. "Ortopedia", "Multi", "Derm · Ped".
  final String? specialtyLabel;
  final ClinicStatus status;

  // Mirrors `neighborhood` / `street_address` / `street_number` /
  // `address_complement` on `facilities`.
  final String? neighborhood;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;

  /// Short single-line address for compact cards, e.g.
  /// "Rua Augusta, 320 — Consolação". Falls back gracefully when parts
  /// are missing, and is `null` when nothing is available at all.
  String? get shortAddress {
    String? streetLine;
    if (streetAddress != null && streetAddress!.isNotEmpty) {
      final hasNumber = streetNumber != null && streetNumber!.isNotEmpty;
      streetLine = hasNumber ? '$streetAddress, $streetNumber' : streetAddress;
      if (addressComplement != null && addressComplement!.isNotEmpty) {
        streetLine = '$streetLine - ${addressComplement!}';
      }
    }
    final hasNeighborhood = neighborhood != null && neighborhood!.isNotEmpty;
    if (streetLine != null && hasNeighborhood) {
      return '$streetLine — ${neighborhood!}';
    }
    return streetLine ?? (hasNeighborhood ? neighborhood : null);
  }
}

// ── Facility status signals (commercial/purchase/conformity — real DB enums) ──

/// Mirrors `commercial_status` on `facilities`: REGISTERED | ACTIVE | SUSPENDED | INACTIVE.
enum FacilityCommercialStatus { registered, active, suspended, inactive }

extension FacilityCommercialStatusX on FacilityCommercialStatus {
  String get label {
    switch (this) {
      case FacilityCommercialStatus.registered:
        return 'Registrada';
      case FacilityCommercialStatus.active:
        return 'Ativa';
      case FacilityCommercialStatus.suspended:
        return 'Suspensa';
      case FacilityCommercialStatus.inactive:
        return 'Inativa';
    }
  }

  Color get color {
    switch (this) {
      case FacilityCommercialStatus.registered:
        return const Color(0xFF3b82f6);
      case FacilityCommercialStatus.active:
        return const Color(0xFF16a373);
      case FacilityCommercialStatus.suspended:
        return const Color(0xFFc6861b);
      case FacilityCommercialStatus.inactive:
        return const Color(0xFF6b7280);
    }
  }
}

/// Mirrors `purchase_status` on `facilities`: NON_BUYER | LOW_BUYER | REGULAR_BUYER | HIGH_BUYER.
/// Displayed to the user as "Tipo de cliente".
enum FacilityPurchaseStatus { nonBuyer, lowBuyer, regularBuyer, highBuyer }

extension FacilityPurchaseStatusX on FacilityPurchaseStatus {
  String get label {
    switch (this) {
      case FacilityPurchaseStatus.nonBuyer:
        return 'Inativa';
      case FacilityPurchaseStatus.lowBuyer:
        return 'Compra ocasional';
      case FacilityPurchaseStatus.regularBuyer:
        return 'Compra regular';
      case FacilityPurchaseStatus.highBuyer:
        return 'Compra frequente';
    }
  }

  Color get color {
    switch (this) {
      case FacilityPurchaseStatus.nonBuyer:
        return const Color(0xFFc6861b);
      case FacilityPurchaseStatus.lowBuyer:
        return const Color(0xFF3b82f6);
      case FacilityPurchaseStatus.regularBuyer:
        return const Color(0xFF1e40af);
      case FacilityPurchaseStatus.highBuyer:
        return const Color(0xFF16a373);
    }
  }
}

/// Mirrors `conformity_status` on `facilities`: INCOMPLETE | COMPLETE | EXPIRING_SOON | NON_CONFORMING.
enum FacilityConformityStatus {
  incomplete,
  complete,
  expiringSoon,
  nonConforming,
}

extension FacilityConformityStatusX on FacilityConformityStatus {
  String get label {
    switch (this) {
      case FacilityConformityStatus.incomplete:
        return 'Incompleta';
      case FacilityConformityStatus.complete:
        return 'Completa';
      case FacilityConformityStatus.expiringSoon:
        return 'Vencendo em breve';
      case FacilityConformityStatus.nonConforming:
        return 'Não conforme';
    }
  }

  Color get color {
    switch (this) {
      case FacilityConformityStatus.incomplete:
        return const Color(0xFF6b7280);
      case FacilityConformityStatus.complete:
        return const Color(0xFF16a373);
      case FacilityConformityStatus.expiringSoon:
        return const Color(0xFFc6861b);
      case FacilityConformityStatus.nonConforming:
        return const Color(0xFFb84545);
    }
  }
}

/// Mirrors `facility_tax_id_type` on `facilities`: PJ | PF.
enum FacilityTaxIdType { pj, pf }

extension FacilityTaxIdTypeX on FacilityTaxIdType {
  String get label => this == FacilityTaxIdType.pj ? 'PJ' : 'PF';

  IconData get icon => this == FacilityTaxIdType.pj
      ? Icons.apartment_rounded
      : Icons.person_rounded;
}

/// Bundle of status signals shown in the header + "Sinais" section.
class FacilityStatusSignals {
  const FacilityStatusSignals({
    required this.commercialStatus,
    required this.purchaseStatus,
    required this.conformityStatus,
    this.lastPurchaseAt,
  });

  final FacilityCommercialStatus commercialStatus;
  final FacilityPurchaseStatus purchaseStatus;
  final FacilityConformityStatus conformityStatus;

  /// Backend-computed from `orders` in Phase 2. Mocked in Phase 1.
  final DateTime? lastPurchaseAt;

  int? get daysSinceLastPurchase => lastPurchaseAt == null
      ? null
      : DateTime.now().difference(lastPurchaseAt!).inDays;
}

/// Mock summary for "Fotos da clínica" — no `facility_photos` table yet.
class PhotoGallerySummary {
  const PhotoGallerySummary({
    required this.count,
    this.thumbnailColors = const [],
    this.lastUpdatedAt,
  });

  final int count;
  final List<Color> thumbnailColors;
  final DateTime? lastUpdatedAt;
}

/// Product performance at this establishment ("Produtos em uso").
class ProductUsage {
  const ProductUsage({
    required this.name,
    required this.revenueLast6m,
    required this.trendPercent,
    required this.sharePercent,
  });

  final String name;
  final double revenueLast6m;

  /// Positive = growth, negative = decline vs. previous period.
  final double trendPercent;

  /// Share of this establishment's revenue for this product, 0-100.
  final double sharePercent;

  bool get isTrendingUp => trendPercent >= 0;
}

/// Private, facility-scoped note ("Notas de campo"). No `facility_notes` table yet.
class FacilityFieldNote {
  const FacilityFieldNote({
    required this.id,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String text;
  final DateTime createdAt;
}

/// Metadata for the "Convênios" donut chart callout.
class PayerMixSummary {
  const PayerMixSummary({
    required this.principalSourceName,
    required this.principalSourcePercent,
    required this.registeredSourceCount,
    this.updatedAt,
  });

  final String principalSourceName;
  final double principalSourcePercent;
  final int registeredSourceCount;
  final DateTime? updatedAt;
}

// ── Rich visit timeline (mock-only — real `visits` schema unchanged in V1) ──

enum VisitSentiment { positive, mixed, negative }

extension VisitSentimentX on VisitSentiment {
  String get label {
    switch (this) {
      case VisitSentiment.positive:
        return 'Positiva';
      case VisitSentiment.mixed:
        return 'Mista';
      case VisitSentiment.negative:
        return 'Negativa';
    }
  }

  Color get color {
    switch (this) {
      case VisitSentiment.positive:
        return const Color(0xFF16a373);
      case VisitSentiment.mixed:
        return const Color(0xFFc6861b);
      case VisitSentiment.negative:
        return const Color(0xFFb84545);
    }
  }
}

class VisitTimelineEntry {
  const VisitTimelineEntry({
    required this.id,
    required this.date,
    required this.title,
    required this.sentiment,
    this.attendees,
    this.sampleGiven,
    this.linkedOrderValue,
    this.summary,
    this.durationMinutes,
    this.consultantInitials,
  });

  final String id;
  final DateTime date;

  /// e.g. "Reunião agendada", "Passagem rápida, recepção", "Fechamento de pedido".
  final String title;
  final VisitSentiment sentiment;
  final String? attendees;
  final String? sampleGiven;
  final double? linkedOrderValue;
  final String? summary;
  final int? durationMinutes;
  final String? consultantInitials;
}

class VisitStats {
  const VisitStats({
    required this.visitCount,
    required this.totalOrdersValue,
    required this.avgDurationMinutes,
    this.periodLabel,
  });

  final int visitCount;
  final double totalOrdersValue;
  final int avgDurationMinutes;
  final String? periodLabel;
}

/// CNES service offered at the facility.
class FacilityServiceChip {
  const FacilityServiceChip({
    required this.serviceCode,
    required this.classificationCode,
  });

  final String serviceCode;
  final String classificationCode;

  String get label => '$serviceCode · $classificationCode';
}

// ── Registration documents ("Cadastro") ───────────────────────

/// Review status of a submitted registration document. No `facility_
/// documents` table exists yet — this mirrors the vocabulary already used
/// for `ingestion.cnes_suggestions.status` (`PENDING`/`APPROVED`/`REJECTED`)
/// plus a `missing` state for a requirement that hasn't been submitted.
enum EstablishmentDocumentStatus { missing, pending, approved, rejected }

extension EstablishmentDocumentStatusX on EstablishmentDocumentStatus {
  String get label {
    switch (this) {
      case EstablishmentDocumentStatus.missing:
        return 'Não enviado';
      case EstablishmentDocumentStatus.pending:
        return 'Em análise';
      case EstablishmentDocumentStatus.approved:
        return 'Aprovado';
      case EstablishmentDocumentStatus.rejected:
        return 'Rejeitado';
    }
  }

  Color get color {
    switch (this) {
      case EstablishmentDocumentStatus.missing:
        return const Color(0xFF9ca3af);
      case EstablishmentDocumentStatus.pending:
        return const Color(0xFFc6861b);
      case EstablishmentDocumentStatus.approved:
        return const Color(0xFF1f9254);
      case EstablishmentDocumentStatus.rejected:
        return const Color(0xFFb84545);
    }
  }

  Color get backgroundColor {
    switch (this) {
      case EstablishmentDocumentStatus.missing:
        return const Color(0xFFf3f4f6);
      case EstablishmentDocumentStatus.pending:
        return const Color(0xFFfef3d5);
      case EstablishmentDocumentStatus.approved:
        return const Color(0xFFe7f6ec);
      case EstablishmentDocumentStatus.rejected:
        return const Color(0xFFfde8e8);
    }
  }

  /// Whether this document still needs rep action (submit or resubmit).
  bool get needsAction =>
      this != EstablishmentDocumentStatus.approved &&
      this != EstablishmentDocumentStatus.pending;
}

/// One registration document requirement (e.g. "Alvará de funcionamento")
/// and its current review state — the "Cadastro" section.
class EstablishmentDocument {
  const EstablishmentDocument({
    required this.id,
    required this.title,
    required this.description,
    this.status = EstablishmentDocumentStatus.missing,
    this.submittedAt,
    this.fileName,
    this.localPath,
    this.mimeType,
    this.reviewerNote,
  });

  final String id;
  final String title;

  /// One-line explanation of what the document is / why it's required.
  final String description;
  final EstablishmentDocumentStatus status;
  final DateTime? submittedAt;

  /// Attached file name — mocked for seeded docs, real after a local pick.
  final String? fileName;

  /// Device path of a file the user just picked this session. Enables
  /// in-app image preview; PDFs/other types still open a full-screen
  /// file viewer sheet (no remote storage yet).
  final String? localPath;

  /// Optional MIME (e.g. `application/pdf`, `image/jpeg`) from the picker.
  final String? mimeType;

  /// Shown when [status] is `rejected`, explaining what needs fixing.
  final String? reviewerNote;

  bool get hasAttachment =>
      (fileName != null && fileName!.isNotEmpty) ||
      (localPath != null && localPath!.isNotEmpty);

  /// True when we can render a real bitmap preview from [localPath].
  bool get canPreviewImage {
    if (localPath == null || localPath!.isEmpty) return false;
    return _looksLikeImage(fileName: fileName, mimeType: mimeType);
  }

  bool get isPdf => _looksLikePdf(fileName: fileName, mimeType: mimeType);

  EstablishmentDocument copyWith({
    EstablishmentDocumentStatus? status,
    DateTime? submittedAt,
    String? fileName,
    String? localPath,
    String? mimeType,
    String? reviewerNote,
    bool clearReviewerNote = false,
  }) {
    return EstablishmentDocument(
      id: id,
      title: title,
      description: description,
      status: status ?? this.status,
      submittedAt: submittedAt ?? this.submittedAt,
      fileName: fileName ?? this.fileName,
      localPath: localPath ?? this.localPath,
      mimeType: mimeType ?? this.mimeType,
      reviewerNote: clearReviewerNote
          ? null
          : (reviewerNote ?? this.reviewerNote),
    );
  }
}

bool _looksLikeImage({String? fileName, String? mimeType}) {
  final mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return true;
  final name = (fileName ?? '').toLowerCase();
  return name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp') ||
      name.endsWith('.heic') ||
      name.endsWith('.gif');
}

bool _looksLikePdf({String? fileName, String? mimeType}) {
  final mime = mimeType?.toLowerCase() ?? '';
  if (mime == 'application/pdf') return true;
  return (fileName ?? '').toLowerCase().endsWith('.pdf');
}

/// Mock bundle for all establishment detail sections (Phase 1).
class EstablishmentDetailSections {
  const EstablishmentDetailSections({
    this.location,
    this.services = const [],
    this.consultantName,
    this.consultantSince,
    this.territoryLabel,
    this.regionZoneLabel,
    this.administrators = const [],
    this.doctors = const [],
    this.payers = const [],
    this.payerMixSummary,
    this.orders = const [],
    this.nearbyEstablishments = const [],
    this.statusSignals,
    this.taxIdType,
    this.photos,
    this.products = const [],
    this.fieldNotes = const [],
    this.visitTimeline = const [],
    this.visitStats,
    this.phone,
    this.email,
    this.documents = const [],
  });

  final EstablishmentLocation? location;
  final List<FacilityServiceChip> services;
  final String? consultantName;
  final DateTime? consultantSince;
  final String? territoryLabel;

  /// e.g. "Z. Sul" — sub-territory / commercial zone label.
  final String? regionZoneLabel;
  final List<AdministrativeProfessional> administrators;
  final List<FacilityCrmDoctor> doctors;
  final List<PayerShare> payers;
  final PayerMixSummary? payerMixSummary;
  final List<FacilityOrderSummary> orders;
  final List<NearbyEstablishment> nearbyEstablishments;
  final FacilityStatusSignals? statusSignals;
  final FacilityTaxIdType? taxIdType;
  final PhotoGallerySummary? photos;
  final List<ProductUsage> products;
  final List<FacilityFieldNote> fieldNotes;

  /// Mock-only rich visit timeline (distinct from the real `clinicVisitsProvider`).
  final List<VisitTimelineEntry> visitTimeline;
  final VisitStats? visitStats;

  /// Facility-level contact — mocked here since the real `ClinicDetail`
  /// (network-backed) doesn't reliably carry these for every facility yet.
  final String? phone;
  final String? email;

  /// "Cadastro" — registration document requirements and their review status.
  final List<EstablishmentDocument> documents;

  /// Unique, ordered specialties across confirmed doctors — drives the header specialty line.
  String? get specialtiesLabel {
    final unique = <String>{};
    for (final doctor in doctors) {
      final specialty = doctor.specialty?.trim();
      if (specialty != null && specialty.isNotEmpty) unique.add(specialty);
    }
    return unique.isEmpty ? null : unique.join(' · ');
  }

  /// "17/abr · Reunião agendada" style label from the most recent visit.
  String? lastInteractionLabel() {
    if (visitTimeline.isEmpty) return null;
    final latest = visitTimeline.first;
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
    final d = latest.date;
    return '${d.day.toString().padLeft(2, '0')}/${months[d.month - 1]} · ${latest.title}';
  }
}

/// Default nearby search radius — matches Explorar proximity (full-screen map).
const double establishmentNearbyDefaultRadiusKm = 50;

/// Default radius for the inline map preview on the detail screen. Anything
/// beyond this is only reachable via "Ver estabelecimentos próximos".
const double establishmentNearbyPreviewRadiusKm = 5;

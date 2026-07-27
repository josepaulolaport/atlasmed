// Domain models for establishment detail sections (Spec 0005).

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// One page of a facility roster (doctors or administrative professionals).
class FacilityRosterPage<T> {
  const FacilityRosterPage({required this.items, required this.pagination});

  final List<T> items;
  final Pagination pagination;
}

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
    this.contactType = 'PROFESSIONAL',
    this.isPartner = false,
    this.isAdministrator = false,
    this.isDecisionMaker = false,
    this.isBuyer = false,
    this.isBiller = false,
    this.isSecretary = false,
    this.relationshipScore,
  });

  final String id;
  final String name;
  final String? roleTitle;
  final String? email;
  final String? phone;

  /// Legacy single label — prefer [roleChipLabels] for UI.
  final String contactType;

  final bool isPartner;
  final bool isAdministrator;
  final bool isDecisionMaker;
  final bool isBuyer;
  final bool isBiller;
  final bool isSecretary;

  /// Authenticated user's relationship (1–10) from
  /// `user_representative_relationships`. Null = not yet assessed.
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

  /// Multi-select role chips for list/profile UI.
  List<String> get roleChipLabels => [
    if (isPartner) 'Sócio',
    if (isAdministrator) 'Administrador',
    if (isDecisionMaker) 'Decisor',
    if (isBuyer) 'Comprador',
    if (isBiller) 'Faturista',
    if (isSecretary) 'Secretária',
  ];

  AdministrativeProfessional copyWith({
    String? id,
    String? name,
    String? roleTitle,
    String? email,
    String? phone,
    String? contactType,
    bool? isPartner,
    bool? isAdministrator,
    bool? isDecisionMaker,
    bool? isBuyer,
    bool? isBiller,
    bool? isSecretary,
    int? relationshipScore,
    bool clearRelationshipScore = false,
  }) {
    return AdministrativeProfessional(
      id: id ?? this.id,
      name: name ?? this.name,
      roleTitle: roleTitle ?? this.roleTitle,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      contactType: contactType ?? this.contactType,
      isPartner: isPartner ?? this.isPartner,
      isAdministrator: isAdministrator ?? this.isAdministrator,
      isDecisionMaker: isDecisionMaker ?? this.isDecisionMaker,
      isBuyer: isBuyer ?? this.isBuyer,
      isBiller: isBiller ?? this.isBiller,
      isSecretary: isSecretary ?? this.isSecretary,
      relationshipScore: clearRelationshipScore
          ? null
          : (relationshipScore ?? this.relationshipScore),
    );
  }
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
    return switch (this) {
      .registered => 'Registrada',
      .active => 'Ativa',
      .suspended => 'Suspensa',
      .inactive => 'Inativa',
    };
  }

  Color get color {
    switch (this) {
      case FacilityCommercialStatus.registered:
        return AppColors.blueAccent;
      case FacilityCommercialStatus.active:
        return AppColors.green;
      case FacilityCommercialStatus.suspended:
        return AppColors.amber;
      case FacilityCommercialStatus.inactive:
        return AppColors.gray500;
    }
  }
}

/// Mirrors `purchase_status` on `facilities`: NON_BUYER | LOW_BUYER | REGULAR_BUYER | HIGH_BUYER.
/// Displayed to the user as "Tipo de cliente".
enum FacilityPurchaseStatus { nonBuyer, lowBuyer, regularBuyer, highBuyer }

extension FacilityPurchaseStatusX on FacilityPurchaseStatus {
  /// Short labels for the header "Compra: …" chip — avoid repeating "Compra"
  /// and never reuse commercial-status wording like "Inativa".
  String get label {
    switch (this) {
      case FacilityPurchaseStatus.nonBuyer:
        return 'Não compra';
      case FacilityPurchaseStatus.lowBuyer:
        return 'Ocasional';
      case FacilityPurchaseStatus.regularBuyer:
        return 'Regular';
      case FacilityPurchaseStatus.highBuyer:
        return 'Frequente';
    }
  }

  Color get color {
    switch (this) {
      case FacilityPurchaseStatus.nonBuyer:
        return AppColors.amber;
      case FacilityPurchaseStatus.lowBuyer:
        return AppColors.blueAccent;
      case FacilityPurchaseStatus.regularBuyer:
        return AppColors.navyBright;
      case FacilityPurchaseStatus.highBuyer:
        return AppColors.green;
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
        return AppColors.gray500;
      case FacilityConformityStatus.complete:
        return AppColors.green;
      case FacilityConformityStatus.expiringSoon:
        return AppColors.amber;
      case FacilityConformityStatus.nonConforming:
        return AppColors.red;
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

/// Maps API `taxIdType` (`PJ` / `PF`, or legacy CNPJ/CPF labels) to the enum.
FacilityTaxIdType? parseFacilityTaxIdType(String? raw) {
  switch (raw?.trim().toUpperCase()) {
    case 'PJ':
    case 'CNPJ':
      return FacilityTaxIdType.pj;
    case 'PF':
    case 'CPF':
      return FacilityTaxIdType.pf;
    default:
      return null;
  }
}

FacilityCommercialStatus? parseFacilityCommercialStatus(String? raw) {
  switch (raw?.trim().toUpperCase()) {
    case 'REGISTERED':
      return FacilityCommercialStatus.registered;
    case 'ACTIVE':
      return FacilityCommercialStatus.active;
    case 'SUSPENDED':
      return FacilityCommercialStatus.suspended;
    case 'INACTIVE':
      return FacilityCommercialStatus.inactive;
    default:
      return null;
  }
}

FacilityConformityStatus? parseFacilityConformityStatus(String? raw) {
  switch (raw?.trim().toUpperCase()) {
    case 'INCOMPLETE':
      return FacilityConformityStatus.incomplete;
    case 'COMPLETE':
      return FacilityConformityStatus.complete;
    case 'EXPIRING_SOON':
      return FacilityConformityStatus.expiringSoon;
    case 'NON_CONFORMING':
      return FacilityConformityStatus.nonConforming;
    default:
      return null;
  }
}

/// Bundle of status signals shown in the header + "Sinais" section.
class FacilityStatusSignals {
  const FacilityStatusSignals({
    required this.commercialStatus,
    this.purchaseStatus,
    required this.conformityStatus,
    this.lastPurchaseAt,
  });

  final FacilityCommercialStatus commercialStatus;

  /// Omitted when the API has no purchase aggregate (no mock fallback).
  final FacilityPurchaseStatus? purchaseStatus;
  final FacilityConformityStatus conformityStatus;

  /// Backend-computed from `orders` in Phase 2. Mocked in Phase 1.
  final DateTime? lastPurchaseAt;

  int? get daysSinceLastPurchase => lastPurchaseAt == null
      ? null
      : DateTime.now().difference(lastPurchaseAt!).inDays;
}

/// Gallery summary for "Fotos da clínica".
/// Prefer [imageUrls] when live; [thumbnailColors] remain for mock placeholders.
class PhotoGallerySummary {
  const PhotoGallerySummary({
    required this.count,
    this.thumbnailColors = const [],
    this.imageUrls = const [],
    this.profileImageUrl,
    this.lastUpdatedAt,
  });

  final int count;
  final List<Color> thumbnailColors;
  final List<String> imageUrls;
  final String? profileImageUrl;
  final DateTime? lastUpdatedAt;

  bool get hasRealImages => imageUrls.isNotEmpty;
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

/// Metadata for the "Fontes Pagadoras" donut chart callout.
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
        return AppColors.green;
      case VisitSentiment.mixed:
        return AppColors.amber;
      case VisitSentiment.negative:
        return AppColors.red;
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
enum EstablishmentDocumentStatus {
  missing,

  /// Files uploaded and processed — waiting for package submit.
  ready,
  pending,
  approved,
  rejected,
}

extension EstablishmentDocumentStatusX on EstablishmentDocumentStatus {
  String get label {
    switch (this) {
      case EstablishmentDocumentStatus.missing:
        return 'Não enviado';
      case EstablishmentDocumentStatus.ready:
        return 'Pronto';
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
        return AppColors.gray400;
      case EstablishmentDocumentStatus.ready:
        return AppColors.navyBright;
      case EstablishmentDocumentStatus.pending:
        return AppColors.amber;
      case EstablishmentDocumentStatus.approved:
        return AppColors.greenDark;
      case EstablishmentDocumentStatus.rejected:
        return AppColors.red;
    }
  }

  Color get backgroundColor {
    switch (this) {
      case EstablishmentDocumentStatus.missing:
        return AppColors.gray100;
      case EstablishmentDocumentStatus.ready:
        return AppColors.blue100;
      case EstablishmentDocumentStatus.pending:
        return AppColors.amber50;
      case EstablishmentDocumentStatus.approved:
        return AppColors.green50;
      case EstablishmentDocumentStatus.rejected:
        return AppColors.red50;
    }
  }

  /// Whether this document still needs rep action (add/replace files).
  bool get needsAction =>
      this == EstablishmentDocumentStatus.missing ||
      this == EstablishmentDocumentStatus.rejected;

  bool get isEditable =>
      this == EstablishmentDocumentStatus.missing ||
      this == EstablishmentDocumentStatus.ready ||
      this == EstablishmentDocumentStatus.rejected;
}

/// Kind of Cadastro checklist row — file upload vs billing email text field.
enum EstablishmentDocumentKind { file, billingEmail }

/// One physical file/page belonging to a logical Cadastro document.
class CadastroDocumentFile {
  const CadastroDocumentFile({
    required this.fileAssetId,
    required this.position,
    required this.role,
    this.fileName,
    this.status,
    this.contentType,
  });

  final String fileAssetId;
  final int position;
  final String role;
  final String? fileName;
  final String? status;
  final String? contentType;

  bool get isReady => status == 'READY';
  bool get isFailed => status == 'FAILED';
  bool get isProcessing =>
      status == 'PROCESSING' ||
      status == 'UPLOADED' ||
      status == 'UPLOADING' ||
      status == 'PENDING_UPLOAD';
  bool get canView => isReady;
  bool get isBusy => isProcessing || status == 'UPLOADING';

  /// 0–1 hint for UI progress (indeterminate stages mapped to steps).
  double get progressValue {
    switch (status) {
      case 'PENDING_UPLOAD':
        return 0.08;
      case 'UPLOADING':
        return 0.35;
      case 'UPLOADED':
        return 0.55;
      case 'PROCESSING':
        return 0.78;
      case 'READY':
        return 1;
      case 'FAILED':
        return 0;
      default:
        return 0.2;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'READY':
        return 'Pronto';
      case 'FAILED':
        return 'Falhou';
      case 'PROCESSING':
      case 'UPLOADED':
        return 'Processando…';
      case 'UPLOADING':
      case 'PENDING_UPLOAD':
        return 'Enviando…';
      default:
        return status ?? '—';
    }
  }

  String get displayTitle => (fileName != null && fileName!.trim().isNotEmpty)
      ? fileName!.trim()
      : 'Arquivo $position';

  bool get isImage =>
      _looksLikeImage(fileName: fileName, mimeType: contentType);
  bool get isPdf => _looksLikePdf(fileName: fileName, mimeType: contentType);

  CadastroDocumentFile copyWith({
    String? fileAssetId,
    int? position,
    String? role,
    String? fileName,
    String? status,
    String? contentType,
  }) {
    return CadastroDocumentFile(
      fileAssetId: fileAssetId ?? this.fileAssetId,
      position: position ?? this.position,
      role: role ?? this.role,
      fileName: fileName ?? this.fileName,
      status: status ?? this.status,
      contentType: contentType ?? this.contentType,
    );
  }
}

/// One past submission of a Cadastro document type (history card).
class CadastroRequirementSubmission {
  const CadastroRequirementSubmission({
    required this.documentId,
    required this.submissionId,
    required this.requirementId,
    required this.title,
    required this.status,
    required this.version,
    this.documentVersion,
    this.reviewComment,
    this.submittedAt,
    this.createdAt,
    this.fileCount = 0,
    this.files = const [],
  });

  final String documentId;
  final String submissionId;
  final String requirementId;
  final String title;
  final String status;
  final int version;
  final int? documentVersion;
  final String? reviewComment;
  final DateTime? submittedAt;
  final DateTime? createdAt;
  final int fileCount;
  final List<CadastroDocumentFile> files;

  bool get isApproved => status == 'APPROVED';
  bool get isUnderReview => status == 'UNDER_REVIEW' || status == 'SUBMITTED';
  bool get isRejected => status == 'REJECTED' || status == 'CHANGES_REQUESTED';

  String get statusLabel {
    switch (status) {
      case 'APPROVED':
        return 'Aprovado';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'Em análise';
      case 'REJECTED':
        return 'Rejeitado';
      case 'CHANGES_REQUESTED':
        return 'Correção solicitada';
      default:
        return status;
    }
  }

  factory CadastroRequirementSubmission.fromJson(Map<String, dynamic> json) {
    final rawFiles = (json['files'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return CadastroRequirementSubmission(
      documentId: json['documentId'] as String? ?? '',
      submissionId: json['submissionId'] as String? ?? '',
      requirementId: json['requirementId'] as String? ?? '',
      title: json['title'] as String? ?? 'Envio',
      status: json['status'] as String? ?? '',
      version: (json['version'] as num?)?.toInt() ?? 1,
      documentVersion: (json['documentVersion'] as num?)?.toInt(),
      reviewComment: json['reviewComment'] as String?,
      submittedAt: json['submittedAt'] != null
          ? DateTime.tryParse(json['submittedAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      fileCount: (json['fileCount'] as num?)?.toInt() ?? rawFiles.length,
      files: rawFiles
          .map(
            (f) => CadastroDocumentFile(
              fileAssetId:
                  f['fileAssetId'] as String? ?? f['id'] as String? ?? '',
              position: (f['position'] as num?)?.toInt() ?? 1,
              role: f['role'] as String? ?? 'PAGE',
              fileName:
                  f['fileName'] as String? ?? f['originalFilename'] as String?,
              status: f['status'] as String?,
              contentType:
                  f['contentType'] as String? ?? f['mimeType'] as String?,
            ),
          )
          .where((f) => f.fileAssetId.isNotEmpty)
          .toList(growable: false),
    );
  }
}

class CadastroApprovedSummary {
  const CadastroApprovedSummary({
    required this.documentId,
    required this.submissionId,
    required this.version,
    this.submittedAt,
    this.reviewComment,
    this.fileCount = 0,
  });

  final String documentId;
  final String submissionId;
  final int version;
  final DateTime? submittedAt;
  final String? reviewComment;
  final int fileCount;

  factory CadastroApprovedSummary.fromJson(Map<String, dynamic> json) {
    return CadastroApprovedSummary(
      documentId: json['documentId'] as String? ?? '',
      submissionId: json['submissionId'] as String? ?? '',
      version: (json['version'] as num?)?.toInt() ?? 1,
      submittedAt: json['submittedAt'] != null
          ? DateTime.tryParse(json['submittedAt'] as String)
          : null,
      reviewComment: json['reviewComment'] as String?,
      fileCount: (json['fileCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// One registration document requirement (e.g. "Identidade")
/// and its current review state — the "Cadastro" section.
class EstablishmentDocument {
  const EstablishmentDocument({
    required this.id,
    required this.title,
    required this.description,
    this.status = EstablishmentDocumentStatus.missing,
    this.kind = EstablishmentDocumentKind.file,
    this.requirementId,
    this.recordId,
    this.documentStatus,
    this.latestSubmittedStatus,
    this.latestSubmittedAt,
    this.currentApproved,
    this.files = const [],
    this.submittedAt,
    this.fileName,
    this.localPath,
    this.remoteUrl,
    this.mimeType,
    this.reviewerNote,
    this.billingEmail,
  });

  final String id;
  final String title;

  /// One-line explanation of what the document is / why it's required.
  final String description;
  final EstablishmentDocumentStatus status;
  final EstablishmentDocumentKind kind;

  /// API conformity requirement id (file rows only).
  final String? requirementId;

  /// Logical submission document id (multi-file model).
  final String? recordId;

  /// Raw API document status (DRAFT, READY, UNDER_REVIEW, …).
  final String? documentStatus;

  final String? latestSubmittedStatus;
  final DateTime? latestSubmittedAt;
  final CadastroApprovedSummary? currentApproved;

  /// Ordered physical files for this logical document.
  final List<CadastroDocumentFile> files;
  final DateTime? submittedAt;

  /// Attached file name — mocked for seeded docs, real after a local pick.
  final String? fileName;

  /// Device path of a file the user just picked this session. Enables
  /// in-app image preview; PDFs/other types still open a full-screen
  /// file viewer sheet.
  final String? localPath;

  /// Authenticated download URL from the Cadastro API (`/facilities/cadastro/files/…`).
  final String? remoteUrl;

  /// Optional MIME (e.g. `application/pdf`, `image/jpeg`) from the picker.
  final String? mimeType;

  /// Shown when [status] is `rejected`, explaining what needs fixing.
  final String? reviewerNote;

  /// Current billing email when [kind] is [EstablishmentDocumentKind.billingEmail].
  final String? billingEmail;

  bool get isBillingEmail => kind == EstablishmentDocumentKind.billingEmail;

  bool get hasAttachment =>
      files.isNotEmpty ||
      (fileName != null && fileName!.isNotEmpty) ||
      (localPath != null && localPath!.isNotEmpty) ||
      (remoteUrl != null && remoteUrl!.isNotEmpty);

  int get readyFileCount => files.where((f) => f.isReady).length;
  int get failedFileCount => files.where((f) => f.isFailed).length;

  bool get allFilesReady => files.isNotEmpty && files.every((f) => f.isReady);

  bool get hasBusyFiles => files.any((f) => f.isBusy);

  String get filesSummary {
    if (files.isEmpty) return 'Nenhum arquivo';
    final n = files.length;
    final ready = readyFileCount;
    if (failedFileCount > 0) {
      return '$n ${n == 1 ? 'arquivo' : 'arquivos'} · $failedFileCount com falha';
    }
    if (hasBusyFiles) {
      return '$n ${n == 1 ? 'arquivo' : 'arquivos'} · processando';
    }
    if (ready == n) {
      return '$n ${n == 1 ? 'arquivo' : 'arquivos'} · prontos';
    }
    return '$n ${n == 1 ? 'arquivo' : 'arquivos'} · $ready prontos';
  }

  /// True when we can render a real bitmap preview from [localPath] or [remoteUrl].
  bool get canPreviewImage {
    if (localPath != null && localPath!.isNotEmpty) {
      return _looksLikeImage(fileName: fileName, mimeType: mimeType);
    }
    if (remoteUrl != null && remoteUrl!.isNotEmpty) {
      return _looksLikeImage(fileName: fileName, mimeType: mimeType);
    }
    return files.any((f) => f.isImage && f.isReady);
  }

  bool get isPdf => _looksLikePdf(fileName: fileName, mimeType: mimeType);

  EstablishmentDocument copyWith({
    String? title,
    String? description,
    EstablishmentDocumentStatus? status,
    EstablishmentDocumentKind? kind,
    String? requirementId,
    String? recordId,
    String? documentStatus,
    String? latestSubmittedStatus,
    DateTime? latestSubmittedAt,
    CadastroApprovedSummary? currentApproved,
    List<CadastroDocumentFile>? files,
    DateTime? submittedAt,
    String? fileName,
    String? localPath,
    String? remoteUrl,
    String? mimeType,
    String? reviewerNote,
    String? billingEmail,
    bool clearReviewerNote = false,
  }) {
    return EstablishmentDocument(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      kind: kind ?? this.kind,
      requirementId: requirementId ?? this.requirementId,
      recordId: recordId ?? this.recordId,
      documentStatus: documentStatus ?? this.documentStatus,
      latestSubmittedStatus:
          latestSubmittedStatus ?? this.latestSubmittedStatus,
      latestSubmittedAt: latestSubmittedAt ?? this.latestSubmittedAt,
      currentApproved: currentApproved ?? this.currentApproved,
      files: files ?? this.files,
      submittedAt: submittedAt ?? this.submittedAt,
      fileName: fileName ?? this.fileName,
      localPath: localPath ?? this.localPath,
      remoteUrl: remoteUrl ?? this.remoteUrl,
      mimeType: mimeType ?? this.mimeType,
      reviewerNote: clearReviewerNote
          ? null
          : (reviewerNote ?? this.reviewerNote),
      billingEmail: billingEmail ?? this.billingEmail,
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
    this.managerName,
    this.managerSince,
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
    this.whatsapp,
    this.email,
    this.documents = const [],
  });

  final EstablishmentLocation? location;
  final List<FacilityServiceChip> services;
  final String? consultantName;
  final DateTime? consultantSince;

  /// Territory manager overseeing the consultant's patch.
  final String? managerName;
  final DateTime? managerSince;

  final String? territoryLabel;

  /// e.g. "Z. Sul" — sub-territory / commercial zone label.
  final String? regionZoneLabel;
  final List<AdministrativeProfessional> administrators;
  final List<ProfessionalRoster> doctors;
  final List<PayerShare> payers;
  final PayerMixSummary? payerMixSummary;
  final List<FacilityOrderSummary> orders;
  final List<NearbyEstablishment> nearbyEstablishments;
  final FacilityStatusSignals? statusSignals;
  final FacilityTaxIdType? taxIdType;
  final PhotoGallerySummary? photos;
  final List<ProductUsage> products;
  final List<FacilityFieldNote> fieldNotes;

  /// Mock-only rich visit timeline (distinct from the real `clinicVisitsRepositoryProvider`).
  final List<VisitTimelineEntry> visitTimeline;
  final VisitStats? visitStats;

  /// Facility-level contact — mocked here since the real `ClinicDetail`
  /// (network-backed) doesn't reliably carry these for every facility yet.
  final String? phone;
  final String? whatsapp;
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

/// Minimum radius on the nearby-map slider (0.1 km steps).
const double establishmentNearbyMinRadiusKm = 0.1;

/// Maximum radius on the nearby-map slider.
const double establishmentNearbyDefaultRadiusKm = 10;

/// Default radius for the inline map preview on the detail screen (and the
/// nearby-map slider's initial value). Anything beyond this is only
/// reachable via "Ver estabelecimentos próximos".
const double establishmentNearbyPreviewRadiusKm = 1;

/// Snap a slider value to the 0.1 km grid within [min, max].
double snapNearbyRadiusKm(double value) {
  final snapped = (value * 10).round() / 10;
  return snapped.clamp(
    establishmentNearbyMinRadiusKm,
    establishmentNearbyDefaultRadiusKm,
  );
}

/// Client-side filter by distance from the search origin (facility).
List<NearbyEstablishment> filterNearbyByRadius(
  List<NearbyEstablishment> all,
  double radiusKm,
) {
  return all.where((e) => e.distanceKm <= radiusKm).toList(growable: false);
}

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Target of a field-change suggestion (clinic vs doctor profile).
enum NaoConformidadeTargetType { clinic, doctor }

extension NaoConformidadeTargetTypeX on NaoConformidadeTargetType {
  String get label {
    switch (this) {
      case NaoConformidadeTargetType.clinic:
        return 'Estabelecimento';
      case NaoConformidadeTargetType.doctor:
        return 'Médico';
    }
  }

  IconData get icon {
    switch (this) {
      case NaoConformidadeTargetType.clinic:
        return Icons.local_hospital_outlined;
      case NaoConformidadeTargetType.doctor:
        return Icons.person_outline_rounded;
    }
  }
}

/// Role of the person who submitted the suggestion.
enum NaoConformidadeSubmitterRole { rep, manager }

extension NaoConformidadeSubmitterRoleX on NaoConformidadeSubmitterRole {
  String get label {
    switch (this) {
      case NaoConformidadeSubmitterRole.rep:
        return 'Representante';
      case NaoConformidadeSubmitterRole.manager:
        return 'Gerente';
    }
  }
}

/// What kind of change the suggestion proposes.
enum NaoConformidadeKind {
  /// Edit a single profile field (phone, email, CRM, …).
  fieldChange,

  /// Request to deactivate a clinic.
  deactivation,
}

extension NaoConformidadeKindX on NaoConformidadeKind {
  String get label {
    switch (this) {
      case NaoConformidadeKind.fieldChange:
        return 'Alteração de campo';
      case NaoConformidadeKind.deactivation:
        return 'Desativação';
    }
  }
}

enum NaoConformidadeStatus { pending, accepted, rejected }

extension NaoConformidadeStatusX on NaoConformidadeStatus {
  String get label {
    switch (this) {
      case NaoConformidadeStatus.pending:
        return 'Pendente';
      case NaoConformidadeStatus.accepted:
        return 'Aceita';
      case NaoConformidadeStatus.rejected:
        return 'Rejeitada';
    }
  }

  Color get color {
    switch (this) {
      case NaoConformidadeStatus.pending:
        return AppColors.amber;
      case NaoConformidadeStatus.accepted:
        return AppColors.green600;
      case NaoConformidadeStatus.rejected:
        return AppColors.error;
    }
  }

  Color get backgroundColor => color.withValues(alpha: 0.12);
}

/// One suggestion to alter clinic/doctor field data, awaiting ops review.
class NaoConformidadeSuggestion {
  const NaoConformidadeSuggestion({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.targetName,
    required this.fieldLabel,
    required this.currentValue,
    required this.suggestedValue,
    required this.submittedByName,
    required this.submittedByRole,
    required this.submittedAt,
    required this.status,
    this.kind = NaoConformidadeKind.fieldChange,
    this.submittedByUserId,
    this.facilityName,
    this.reason,
    this.reviewerNote,
    this.reviewedAt,
    this.reviewedByName,
  });

  final int id;
  final NaoConformidadeKind kind;
  final NaoConformidadeTargetType targetType;
  final int targetId;
  final String targetName;

  /// Parent clinic name when [targetType] is doctor.
  final String? facilityName;

  /// Human-readable field name (e.g. "Telefone") or "Status comercial"
  /// for deactivation.
  final String fieldLabel;
  final String currentValue;
  final String suggestedValue;

  /// Optional free-text reason (used especially for deactivation).
  final String? reason;

  /// Stable owner id — establishment screens only show matching rows.
  final int? submittedByUserId;
  final String submittedByName;
  final NaoConformidadeSubmitterRole submittedByRole;
  final DateTime submittedAt;

  final NaoConformidadeStatus status;
  final String? reviewerNote;
  final DateTime? reviewedAt;
  final String? reviewedByName;

  bool get isPending => status == NaoConformidadeStatus.pending;

  bool get isDeactivation => kind == NaoConformidadeKind.deactivation;

  String get contextSubtitle {
    if (targetType == NaoConformidadeTargetType.doctor &&
        facilityName != null &&
        facilityName!.isNotEmpty) {
      return facilityName!;
    }
    return targetType.label;
  }

  /// Title used on detail screens.
  String get detailTitle =>
      isDeactivation ? 'Desativação do estabelecimento' : fieldLabel;

  bool isOwnedBy({int? userId, required String? displayName}) {
    if (userId != null &&
        userId > 0 &&
        submittedByUserId != null &&
        submittedByUserId! > 0) {
      return submittedByUserId == userId;
    }
    if (displayName == null || displayName.trim().isEmpty) return false;
    return submittedByName.trim().toLowerCase() ==
        displayName.trim().toLowerCase();
  }

  NaoConformidadeSuggestion copyWith({
    NaoConformidadeStatus? status,
    String? reviewerNote,
    DateTime? reviewedAt,
    String? reviewedByName,
    bool clearReviewerNote = false,
  }) {
    return NaoConformidadeSuggestion(
      id: id,
      kind: kind,
      targetType: targetType,
      targetId: targetId,
      targetName: targetName,
      facilityName: facilityName,
      fieldLabel: fieldLabel,
      currentValue: currentValue,
      suggestedValue: suggestedValue,
      reason: reason,
      submittedByUserId: submittedByUserId,
      submittedByName: submittedByName,
      submittedByRole: submittedByRole,
      submittedAt: submittedAt,
      status: status ?? this.status,
      reviewerNote: clearReviewerNote
          ? null
          : (reviewerNote ?? this.reviewerNote),
      reviewedAt: reviewedAt ?? this.reviewedAt,
      reviewedByName: reviewedByName ?? this.reviewedByName,
    );
  }
}

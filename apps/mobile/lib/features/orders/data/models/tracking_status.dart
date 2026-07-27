import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

// ── Tracking status ──────────────────────────────────────────
enum TrackingStatus {
  pending,
  confirmed,
  processing,
  shipped,
  delivered,
  cancelled,
}

extension TrackingStatusX on TrackingStatus {
  String get label {
    switch (this) {
      case TrackingStatus.pending:
        return 'Pendente';
      case TrackingStatus.confirmed:
        return 'Confirmado';
      case TrackingStatus.processing:
        return 'Em preparação';
      case TrackingStatus.shipped:
        return 'Saiu para entrega';
      case TrackingStatus.delivered:
        return 'Entregue';
      case TrackingStatus.cancelled:
        return 'Cancelado';
    }
  }

  String get icon {
    switch (this) {
      case TrackingStatus.pending:
        return '⏱';
      case TrackingStatus.confirmed:
        return '✓';
      case TrackingStatus.processing:
        return '🔄';
      case TrackingStatus.shipped:
        return '🚚';
      case TrackingStatus.delivered:
        return '📦';
      case TrackingStatus.cancelled:
        return '✕';
    }
  }

  Color get color {
    switch (this) {
      case TrackingStatus.pending:
        return const AppColors.amber;
      case TrackingStatus.confirmed:
        return const AppColors.green;
      case TrackingStatus.processing:
        return const Color(0xFF1d4ed8);
      case TrackingStatus.shipped:
        return const Color(0xFF8b5cf6);
      case TrackingStatus.delivered:
        return const AppColors.green;
      case TrackingStatus.cancelled:
        return const Color(0xFFef4444);
    }
  }

  Color get tone {
    switch (this) {
      case TrackingStatus.pending:
        return const AppColors.amber50;
      case TrackingStatus.confirmed:
        return const AppColors.green50;
      case TrackingStatus.processing:
        return const Color(0xFFeef2ff);
      case TrackingStatus.shipped:
        return const AppColors.blueLight;
      case TrackingStatus.delivered:
        return const AppColors.green50;
      case TrackingStatus.cancelled:
        return const AppColors.red50;
    }
  }
}

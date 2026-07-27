import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

// ── Order status ─────────────────────────────────────────────
enum OrderStatus { draft, pending, approved, invoiced, rejected, noBilling }

extension OrderStatusX on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.draft:
        return 'Rascunho';
      case OrderStatus.pending:
        return 'Pendente';
      case OrderStatus.approved:
        return 'Aprovado';
      case OrderStatus.invoiced:
        return 'Faturado';
      case OrderStatus.rejected:
        return 'Rejeitado';
      case OrderStatus.noBilling:
        return 'Sem Faturamento';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.draft:
        return const AppColors.gray500;
      case OrderStatus.pending:
        return const AppColors.amber;
      case OrderStatus.approved:
        return const AppColors.navyBright;
      case OrderStatus.invoiced:
        return const AppColors.green;
      case OrderStatus.rejected:
        return const AppColors.red;
      case OrderStatus.noBilling:
        return const AppColors.purple;
    }
  }

  Color get bg {
    switch (this) {
      case OrderStatus.draft:
        return const Color(0x1F6b7280);
      case OrderStatus.pending:
        return const Color(0x21c6861b);
      case OrderStatus.approved:
        return const Color(0x1C1e40af);
      case OrderStatus.invoiced:
        return const Color(0x1F16a373);
      case OrderStatus.rejected:
        return const Color(0x1Fb84545);
      case OrderStatus.noBilling:
        return const Color(0x1A7c3aed);
    }
  }
}

OrderStatus orderStatusFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'DRAFT':
      return OrderStatus.draft;
    case 'PENDING':
      return OrderStatus.pending;
    case 'APPROVED':
      return OrderStatus.approved;
    case 'INVOICED':
      return OrderStatus.invoiced;
    case 'REJECTED':
      return OrderStatus.rejected;
    case 'NO_BILLING':
      return OrderStatus.noBilling;
    default:
      return OrderStatus.pending;
  }
}

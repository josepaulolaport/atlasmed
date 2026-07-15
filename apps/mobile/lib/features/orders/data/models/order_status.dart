import 'package:flutter/material.dart';

// ── Order status ─────────────────────────────────────────────
enum OrderStatus { draft, pending, confirmed, shipped, delivered, cancelled, rejected }

extension OrderStatusX on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.draft:
        return 'Rascunho';
      case OrderStatus.pending:
        return 'Pendente';
      case OrderStatus.confirmed:
        return 'Confirmado';
      case OrderStatus.shipped:
        return 'Em trânsito';
      case OrderStatus.delivered:
        return 'Entregue';
      case OrderStatus.cancelled:
        return 'Cancelado';
      case OrderStatus.rejected:
        return 'Rejeitado';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.draft:
        return const Color(0xFF6b7280);
      case OrderStatus.pending:
        return const Color(0xFFc6861b);
      case OrderStatus.confirmed:
        return const Color(0xFF1e40af);
      case OrderStatus.shipped:
        return const Color(0xFF0a2f7f);
      case OrderStatus.delivered:
        return const Color(0xFF16a373);
      case OrderStatus.cancelled:
        return const Color(0xFFb84545);
      case OrderStatus.rejected:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case OrderStatus.draft:
        return const Color(0x1F6b7280);
      case OrderStatus.pending:
        return const Color(0x21c6861b);
      case OrderStatus.confirmed:
        return const Color(0x1C1e40af);
      case OrderStatus.shipped:
        return const Color(0x1A0a2f7f);
      case OrderStatus.delivered:
        return const Color(0x1F16a373);
      case OrderStatus.cancelled:
        return const Color(0x1Fb84545);
      case OrderStatus.rejected:
        return const Color(0x1Fb84545);
    }
  }
}

OrderStatus orderStatusFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'DRAFT':
      return OrderStatus.draft;
    case 'PENDING':
      return OrderStatus.pending;
    case 'CONFIRMED':
      return OrderStatus.confirmed;
    case 'SHIPPED':
      return OrderStatus.shipped;
    case 'DELIVERED':
      return OrderStatus.delivered;
    case 'CANCELLED':
      return OrderStatus.cancelled;
    case 'REJECTED':
      return OrderStatus.rejected;
    default:
      return OrderStatus.pending;
  }
}

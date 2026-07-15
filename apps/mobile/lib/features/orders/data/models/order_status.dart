import 'package:flutter/material.dart';

// ── Order status ─────────────────────────────────────────────
enum OrderStatus { pending, separating, transit, delivered, cancelled }

extension OrderStatusX on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.pending:
        return 'Pendente';
      case OrderStatus.separating:
        return 'Em separação';
      case OrderStatus.transit:
        return 'Em trânsito';
      case OrderStatus.delivered:
        return 'Entregue';
      case OrderStatus.cancelled:
        return 'Cancelado';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.pending:
        return const Color(0xFFc6861b);
      case OrderStatus.separating:
        return const Color(0xFF1e40af);
      case OrderStatus.transit:
        return const Color(0xFF0a2f7f);
      case OrderStatus.delivered:
        return const Color(0xFF16a373);
      case OrderStatus.cancelled:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case OrderStatus.pending:
        return const Color(0x21c6861b);
      case OrderStatus.separating:
        return const Color(0x1C1e40af);
      case OrderStatus.transit:
        return const Color(0x1A0a2f7f);
      case OrderStatus.delivered:
        return const Color(0x1F16a373);
      case OrderStatus.cancelled:
        return const Color(0x1Fb84545);
    }
  }
}

import 'package:flutter/material.dart';

// ── Order status ─────────────────────────────────────────────
enum OrderStatus { pendente, separacao, transito, entregue, cancelado }

extension OrderStatusX on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.pendente:
        return 'Pendente';
      case OrderStatus.separacao:
        return 'Em separação';
      case OrderStatus.transito:
        return 'Em trânsito';
      case OrderStatus.entregue:
        return 'Entregue';
      case OrderStatus.cancelado:
        return 'Cancelado';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.pendente:
        return const Color(0xFFc6861b);
      case OrderStatus.separacao:
        return const Color(0xFF1e40af);
      case OrderStatus.transito:
        return const Color(0xFF0a2f7f);
      case OrderStatus.entregue:
        return const Color(0xFF16a373);
      case OrderStatus.cancelado:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case OrderStatus.pendente:
        return const Color(0x21c6861b);
      case OrderStatus.separacao:
        return const Color(0x1C1e40af);
      case OrderStatus.transito:
        return const Color(0x1A0a2f7f);
      case OrderStatus.entregue:
        return const Color(0x1F16a373);
      case OrderStatus.cancelado:
        return const Color(0x1Fb84545);
    }
  }
}

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
        return const Color(0xFFf59e0b);
      case TrackingStatus.confirmed:
        return const Color(0xFF16a373);
      case TrackingStatus.processing:
        return const Color(0xFF1d4ed8);
      case TrackingStatus.shipped:
        return const Color(0xFF8b5cf6);
      case TrackingStatus.delivered:
        return const Color(0xFF16a373);
      case TrackingStatus.cancelled:
        return const Color(0xFFef4444);
    }
  }

  Color get tone {
    switch (this) {
      case TrackingStatus.pending:
        return const Color(0xFFfef3e1);
      case TrackingStatus.confirmed:
        return const Color(0xFFe7f6ef);
      case TrackingStatus.processing:
        return const Color(0xFFeef2ff);
      case TrackingStatus.shipped:
        return const Color(0xFFf3eefe);
      case TrackingStatus.delivered:
        return const Color(0xFFe7f6ef);
      case TrackingStatus.cancelled:
        return const Color(0xFFfee2e2);
    }
  }
}

// ── BRL formatter ───────────────────────────────────────────
String brl(double value) {
  final parts = value.toStringAsFixed(2).split('.');
  final intPart = parts[0];
  final decPart = parts[1];
  final buf = StringBuffer();
  int count = 0;
  for (int i = intPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 == 0) buf.write('.');
    buf.write(intPart[i]);
    count++;
  }
  return 'R\$${buf.toString().split('').reversed.join()},$decPart';
}

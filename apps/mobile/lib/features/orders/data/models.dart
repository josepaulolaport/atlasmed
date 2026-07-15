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

// ── Tracking status for the tracking screen ──────────────────
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

// ── Product model ────────────────────────────────────────────
class Product {
  final String id;
  final String name;
  final String sub;
  final double unit;
  final String category;
  final String? tag;

  const Product({
    required this.id,
    required this.name,
    required this.sub,
    required this.unit,
    required this.category,
    this.tag,
  });
}

// ── Cart item ────────────────────────────────────────────────
class CartItem {
  final String productId;
  final String productName;
  final String productSubtitle;
  final int qty;
  final double unitPrice;
  final double? catalogUnitPrice;
  final String? priceMode;

  const CartItem({
    required this.productId,
    required this.productName,
    required this.productSubtitle,
    required this.qty,
    required this.unitPrice,
    this.catalogUnitPrice,
    this.priceMode,
  });

  CartItem copyWith({
    int? qty,
    double? unitPrice,
    double? catalogUnitPrice,
    String? priceMode,
  }) {
    return CartItem(
      productId: productId,
      productName: productName,
      productSubtitle: productSubtitle,
      qty: qty ?? this.qty,
      unitPrice: unitPrice ?? this.unitPrice,
      catalogUnitPrice: catalogUnitPrice ?? this.catalogUnitPrice,
      priceMode: priceMode ?? this.priceMode,
    );
  }
}

// ── Order list item ──────────────────────────────────────────
class OrderListItem {
  final String id;
  final String clinic;
  final String doctor;
  final String date;
  final String value;
  final OrderStatus status;
  final int items;

  const OrderListItem({
    required this.id,
    required this.clinic,
    required this.doctor,
    required this.date,
    required this.value,
    required this.status,
    required this.items,
  });
}

// ── Timeline step ────────────────────────────────────────────
class TimelineStep {
  final String step;
  final String date;
  final bool done;
  final bool current;

  const TimelineStep({
    required this.step,
    required this.date,
    required this.done,
    this.current = false,
  });
}

// ── Order detail item ────────────────────────────────────────
class OrderDetailItem {
  final String productId;
  final int qty;

  const OrderDetailItem({required this.productId, required this.qty});
}

// ── Order detail ─────────────────────────────────────────────
class OrderDetail {
  final String id;
  final String placedAt;
  final String clinic;
  final String clinicAddress;
  final String doctor;
  final String doctorCrm;
  final OrderStatus status;
  final List<OrderDetailItem> items;
  final double shipping;
  final String paymentMethod;
  final String invoice;
  final String tracking;
  final String estimate;
  final List<TimelineStep> timeline;

  const OrderDetail({
    required this.id,
    required this.placedAt,
    required this.clinic,
    required this.clinicAddress,
    required this.doctor,
    required this.doctorCrm,
    required this.status,
    required this.items,
    required this.shipping,
    required this.paymentMethod,
    required this.invoice,
    required this.tracking,
    required this.estimate,
    required this.timeline,
  });
}

// ── Driver info for tracking ─────────────────────────────────
class DriverInfo {
  final String name;
  final String vehicle;
  final String phone;
  final double rating;
  final String eta;

  const DriverInfo({
    required this.name,
    required this.vehicle,
    required this.phone,
    required this.rating,
    required this.eta,
  });
}

// ── Tracking order item ──────────────────────────────────────
class TrackingOrderItem {
  final String id;
  final String productName;
  final String code;
  final int quantity;
  final String unit;
  final String subtotal;

  const TrackingOrderItem({
    required this.id,
    required this.productName,
    required this.code,
    required this.quantity,
    required this.unit,
    required this.subtotal,
  });
}

// ── Tracking event ───────────────────────────────────────────
class TrackingEvent {
  final TrackingStatus status;
  final String timestamp;
  final String description;

  const TrackingEvent({
    required this.status,
    required this.timestamp,
    required this.description,
  });
}

// ── Tracking order detail ────────────────────────────────────
class TrackingOrderDetail {
  final String id;
  final TrackingStatus status;
  final String createdAt;
  final String estimatedDelivery;
  final String paymentMethod;
  final String total;
  final TrackingClinic clinic;
  final List<TrackingOrderItem> items;
  final List<TrackingEvent> timeline;
  final DriverInfo? driver;

  const TrackingOrderDetail({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.estimatedDelivery,
    required this.paymentMethod,
    required this.total,
    required this.clinic,
    required this.items,
    required this.timeline,
    this.driver,
  });
}

class TrackingClinic {
  final String id;
  final String name;
  final String address;

  const TrackingClinic({
    required this.id,
    required this.name,
    required this.address,
  });
}

// ── Price agreement for ProductOrderSheet ───────────────────
class PriceSuggestion {
  final double unit;
  final String date;
  final String kind; // 'tabela', 'recorrente', 'campanha'
  final bool isDiscounted;
  final int discountPct;
  final List<PriceHistoryEntry> history;

  const PriceSuggestion({
    required this.unit,
    required this.date,
    required this.kind,
    this.isDiscounted = false,
    this.discountPct = 0,
    this.history = const [],
  });
}

class PriceHistoryEntry {
  final double unit;
  final String date;
  final String kind;
  final int qty;
  final String orderId;

  const PriceHistoryEntry({
    required this.unit,
    required this.date,
    required this.kind,
    required this.qty,
    required this.orderId,
  });
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
  return 'R\$ ${buf.toString().split('').reversed.join()},$decPart';
}

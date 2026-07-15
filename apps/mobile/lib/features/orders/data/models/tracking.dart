import 'models.dart' show TrackingStatus;

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

// ── Price suggestion for ProductOrderSheet ───────────────────
class PriceSuggestion {
  final double unit;
  final String date;
  final String kind;
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

import 'order_status.dart';

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
  final String? name;
  final double? unitPrice;

  const OrderDetailItem({
    required this.productId,
    required this.qty,
    this.name,
    this.unitPrice,
  });
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

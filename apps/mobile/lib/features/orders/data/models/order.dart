import 'order_status.dart';

/// View models for the Pedidos screens.
///
/// Every field here has a column behind it. The previous shape carried
/// `paymentMethod`, `invoice`, `tracking`, `estimate`, `clinicAddress`,
/// `doctorCrm` and a `timeline` — none of which exist anywhere in the schema.
/// They were filled with empty strings and one synthesized entry, except
/// `paymentMethod`, which was parsed out of the order's free-text `notes` and
/// defaulted to "credit", so every order claimed a payment method nobody had
/// recorded.
///
/// The ordering professional is deliberately absent too. `orders.person_id`
/// exists and 174 orders carry one, but the screens no longer show it.

// ── Order list item ──────────────────────────────────────────
class OrderListItem {
  final int id;

  /// `PED-1234` for an imported order, the bare id otherwise — the number a rep
  /// reads back over the phone. The list showed the raw database id before.
  final String displayId;
  final String clinic;
  final String? seller;
  final String date;
  final String value;
  final OrderStatus status;
  final int items;

  const OrderListItem({
    required this.id,
    required this.displayId,
    required this.clinic,
    required this.seller,
    required this.date,
    required this.value,
    required this.status,
    required this.items,
  });
}

// ── Order detail item ────────────────────────────────────────
class OrderDetailItem {
  final int? productId;
  final double qty;
  final String? name;

  /// The catalogue code, shown under the name so a rep can match it to a box.
  final String? code;
  final double unitPrice;
  final double lineTotal;

  /// Written off — the line was supplied without being billed.
  final bool writtenOff;
  final String? batchNumber;

  const OrderDetailItem({
    required this.productId,
    required this.qty,
    required this.name,
    required this.code,
    required this.unitPrice,
    required this.lineTotal,
    required this.writtenOff,
    required this.batchNumber,
  });
}

// ── Order detail ─────────────────────────────────────────────
class OrderDetail {
  final int id;
  final String displayId;
  final String placedAt;
  final String? updatedAt;
  final String clinic;
  final String? seller;
  final OrderStatus status;

  /// SALE / CONSIGNMENT / DONATION / OTHER — every row in the current data is
  /// SALE, but the column is real and a consignment reads very differently to
  /// a rep looking at the same total.
  final String type;
  final String? notes;
  final String currency;
  final List<OrderDetailItem> items;
  final double itemsTotal;
  final double total;

  const OrderDetail({
    required this.id,
    required this.displayId,
    required this.placedAt,
    required this.updatedAt,
    required this.clinic,
    required this.seller,
    required this.status,
    required this.type,
    required this.notes,
    required this.currency,
    required this.items,
    required this.itemsTotal,
    required this.total,
  });
}

import 'price_mode.dart';

// ── Product model (mock) ─────────────────────────────────────
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
  final PriceMode? priceMode;

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
    PriceMode? priceMode,
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

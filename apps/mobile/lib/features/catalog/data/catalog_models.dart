// ── Catalog models ────────────────────────────────────────────
//
// These back the product information pages (Reviscon / Evisc / Truvisc) and
// the Brasíndice/Simpro comparison table. Kept UI-friendly and free of any
// transport concerns so the same shapes can later be filled from the API.

/// A single sellable presentation of a product (e.g. "REVISCON 1.0%").
class ProductVariant {
  final String name;
  final String? imageUrl;
  final String simproCode;
  final String brasindiceCode;
  final String tissCode;
  final double price; // VALOR in BRL

  const ProductVariant({
    required this.name,
    this.imageUrl,
    required this.simproCode,
    required this.brasindiceCode,
    required this.tissCode,
    required this.price,
  });
}

/// A product family/brand grouping several variants (e.g. "REVISCON").
class ProductFamily {
  final String id; // slug: reviscon | evisc | truvisc
  final String name;
  final String originFlagEmoji; // country of origin flag shown in the header
  final List<ProductVariant> variants;
  final DateTime brasindicePublishedAt;
  final DateTime simproPublishedAt;

  const ProductFamily({
    required this.id,
    required this.name,
    required this.originFlagEmoji,
    required this.variants,
    required this.brasindicePublishedAt,
    required this.simproPublishedAt,
  });
}

/// One row in the Brasíndice/Simpro comparison table.
class PriceTableRow {
  final String productName;
  final List<String> tags; // e.g. ["NACIONAL", "ALEMANHA"]
  final DateTime updatedAt;
  final double price17; // ICMS 17%
  final double price18; // ICMS 18%
  final double price20; // ICMS 20%
  final bool isOwn; // highlight AtlasMed's own product

  const PriceTableRow({
    required this.productName,
    this.tags = const [],
    required this.updatedAt,
    required this.price17,
    required this.price18,
    required this.price20,
    this.isOwn = false,
  });
}

/// A group of comparable products in the price table (e.g. all 1.0% products).
class PriceTableGroup {
  final String familyName; // e.g. "REVISCON 1.0% - 20MG / 2ML"
  final List<PriceTableRow> rows;

  const PriceTableGroup({required this.familyName, required this.rows});
}

/// A single line in a Tabela Brasíndice/Simpro comparison — either the
/// AtlasMed variant itself ([isOwn] = true, one per table) or a competitor's
/// equivalent product pulled from `product_equivalences`.
class ComparisonRow {
  const ComparisonRow({
    required this.id,
    required this.label,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.price17,
    required this.price18,
    required this.price20,
    required this.updatedAt,
    required this.isOwn,
  });

  final String id;
  final String label;
  final String manufacturer;
  final String countryOfOrigin;
  final double price17;
  final double price18;
  final double price20;
  final DateTime updatedAt;
  final bool isOwn;
}

/// All comparison rows for a single AtlasMed variant, keyed by the variant's
/// display label (e.g. "REVISCON 1.0% - 20MG / 2ML").
class ComparisonGroup {
  const ComparisonGroup({
    required this.variantId,
    required this.variantLabel,
    required this.rows,
  });

  final String variantId;
  final String variantLabel;
  final List<ComparisonRow> rows;
}

enum ComparisonSortColumn { icms17, icms18, icms20 }

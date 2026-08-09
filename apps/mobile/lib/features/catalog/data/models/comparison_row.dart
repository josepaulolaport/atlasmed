import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

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

  final int id;
  final String label;
  final String manufacturer;
  final String countryOfOrigin;
  final double price17;
  final double price18;
  final double price20;
  final DateTime updatedAt;
  final bool isOwn;

  factory ComparisonRow.fromJson(Map<String, dynamic> json) {
    double readPrice(Object? value) => switch (value) {
      num v => v.toDouble(),
      String v => double.tryParse(v) ?? 0,
      _ => 0,
    };

    return ComparisonRow(
      id: readCrmId(json['id'], 'id'),
      label: json['label'] as String,
      manufacturer: json['manufacturer'] as String? ?? '',
      countryOfOrigin: json['countryOfOrigin'] as String? ?? '',
      price17: readPrice(json['price17']),
      price18: readPrice(json['price18']),
      price20: readPrice(json['price20']),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.now(),
      isOwn: json['isOwn'] as bool? ?? false,
    );
  }
}

/// All comparison rows for a single AtlasMed variant, keyed by the variant's
/// display label (e.g. "REVISCON 1.0% - 20MG / 2ML").
class ComparisonGroup {
  const ComparisonGroup({
    required this.variantId,
    required this.variantLabel,
    required this.rows,
  });

  final int variantId;
  final String variantLabel;
  final List<ComparisonRow> rows;

  factory ComparisonGroup.fromJson(Map<String, dynamic> json) {
    return ComparisonGroup(
      variantId: readCrmId(json['productId'], 'productId'),
      variantLabel: json['productLabel'] as String,
      rows: (json['rows'] as List<dynamic>)
          .map((row) => ComparisonRow.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }
}

enum ComparisonSortColumn { icms17, icms18, icms20 }

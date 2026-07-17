import 'package:atlasmed_mobile_app/features/catalog/data/mock/mock_catalog_data.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';

/// Mock, mobile-only data source for the Catálogo de Produtos feature.
///
/// The public method signatures mirror the shape a future HTTP-backed
/// repository (`GET /api/v1/products`, `GET /api/v1/products/:id/comparativo`,
/// `GET /api/v1/products/brasindice` — none implemented on the API yet)
/// would expose, so wiring real endpoints later only touches this class.
class CatalogRepository {
  static const _simulatedLatency = Duration(milliseconds: 300);

  Future<List<CatalogFamily>> getFamilies() async {
    await Future.delayed(_simulatedLatency);

    final byFamily = <String, List<String>>{};
    for (final variant in mockVariants) {
      byFamily.putIfAbsent(variant.familyName, () => []).add(variant.id);
    }

    return byFamily.entries.map((entry) {
      final variants = mockVariants
          .where((v) => v.familyName == entry.key)
          .toList();
      final first = variants.first;
      final publication = mockFamilyPublication[entry.key];
      return CatalogFamily(
        id: entry.key,
        name: entry.key,
        manufacturer: first.manufacturer,
        countryOfOrigin: first.countryOfOrigin,
        variants: variants,
        brasindicePublishedAt:
            publication?.brasindice ?? first.brasindiceUpdatedAt,
        simproPublishedAt: publication?.simpro ?? first.brasindiceUpdatedAt,
      );
    }).toList();
  }

  /// Returns the "Comparativo" for a single AtlasMed variant: the variant
  /// itself plus every competitor equivalence registered for it, sorted by
  /// [sortBy] descending. This is scoped to exactly one product — it is
  /// distinct from [getFullPriceIndex], which lists every product in the
  /// catalog regardless of equivalence.
  Future<ComparisonGroup> getComparison(
    String variantId, {
    ComparisonSortColumn sortBy = ComparisonSortColumn.icms20,
  }) async {
    await Future.delayed(_simulatedLatency);

    final variant = mockVariants.firstWhere((v) => v.id == variantId);
    final competitorIds = mockEquivalences[variantId] ?? const [];

    final rows = <ComparisonRow>[
      _ownRow(variant),
      for (final competitorId in competitorIds)
        if (mockCompetitorProducts[competitorId] case final competitor?)
          _competitorRow(competitor),
    ];
    _sortByPrice(rows, sortBy);

    return ComparisonGroup(
      variantId: variant.id,
      variantLabel: variant.comparisonLabel,
      rows: rows,
    );
  }

  /// Returns the complete Tabela Brasíndice/Simpro: every AtlasMed variant
  /// and every competitor product in the catalog, flattened into a single
  /// sorted list — the full price index, not scoped to any one product.
  Future<List<ComparisonRow>> getFullPriceIndex({
    ComparisonSortColumn sortBy = ComparisonSortColumn.icms20,
  }) async {
    await Future.delayed(_simulatedLatency);

    final rows = <ComparisonRow>[
      for (final variant in mockVariants) _ownRow(variant),
      for (final competitor in mockCompetitorProducts.values)
        _competitorRow(competitor),
    ];
    _sortByPrice(rows, sortBy);
    return rows;
  }

  ComparisonRow _ownRow(CatalogVariant variant) => ComparisonRow(
    id: variant.id,
    label: variant.comparisonLabel,
    manufacturer: variant.manufacturer,
    countryOfOrigin: variant.countryOfOrigin,
    price17: variant.price17,
    price18: variant.price18,
    price20: variant.price20,
    updatedAt: variant.brasindiceUpdatedAt,
    isOwn: true,
  );

  ComparisonRow _competitorRow(CompetitorProduct competitor) => ComparisonRow(
    id: competitor.id,
    label: competitor.name,
    manufacturer: competitor.manufacturer,
    countryOfOrigin: competitor.countryOfOrigin,
    price17: competitor.price17,
    price18: competitor.price18,
    price20: competitor.price20,
    updatedAt: competitor.brasindiceUpdatedAt,
    isOwn: false,
  );

  void _sortByPrice(List<ComparisonRow> rows, ComparisonSortColumn sortBy) {
    rows.sort((a, b) => _priceFor(b, sortBy).compareTo(_priceFor(a, sortBy)));
  }

  double _priceFor(ComparisonRow row, ComparisonSortColumn column) {
    switch (column) {
      case ComparisonSortColumn.icms17:
        return row.price17;
      case ComparisonSortColumn.icms18:
        return row.price18;
      case ComparisonSortColumn.icms20:
        return row.price20;
    }
  }
}

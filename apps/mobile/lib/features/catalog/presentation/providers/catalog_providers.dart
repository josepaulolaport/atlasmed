import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository();
});

final catalogFamiliesProvider = FutureProvider<List<CatalogFamily>>((ref) {
  return ref.watch(catalogRepositoryProvider).getFamilies();
});

/// "Comparativo" for a single AtlasMed variant — that product plus its
/// registered competitor equivalences only.
final catalogComparisonProvider =
    FutureProvider.family<ComparisonGroup, String>((ref, variantId) {
      return ref.watch(catalogRepositoryProvider).getComparison(variantId);
    });

/// Complete Tabela Brasíndice/Simpro — every product in the catalog.
final catalogPriceIndexProvider = FutureProvider<List<ComparisonRow>>((ref) {
  return ref.watch(catalogRepositoryProvider).getFullPriceIndex();
});

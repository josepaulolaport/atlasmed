import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_business_vertical.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository();
});

/// Active commercial sectors — backs the admin product form's sector
/// picker only, so it's read once per form open rather than kept live.
final catalogVerticalsProvider = FutureProvider<List<CatalogBusinessVertical>>((
  ref,
) {
  return ref.watch(catalogRepositoryProvider).getVerticals();
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

/// Every competitor product in the catalog — backs the admin-only
/// "gerenciar concorrentes" picker.
final catalogAllCompetitorsProvider = FutureProvider<List<CompetitorProduct>>((
  ref,
) {
  return ref.watch(catalogRepositoryProvider).getAllCompetitorProducts();
});

/// Competitor products not yet linked to [variantId] — the "adicionar
/// existente" step of the admin competitor picker.
final catalogUnlinkedCompetitorsProvider =
    FutureProvider.family<List<CompetitorProduct>, String>((ref, variantId) {
      return ref
          .watch(catalogRepositoryProvider)
          .getUnlinkedCompetitors(variantId);
    });

/// Invalidates every catalog read provider — call after any admin
/// mutation (create/update variant, link/unlink competitor) so every
/// screen reading from the repository refetches immediately.
void invalidateCatalog(WidgetRef ref, {String? variantId}) {
  ref.invalidate(catalogFamiliesProvider);
  ref.invalidate(catalogPriceIndexProvider);
  ref.invalidate(catalogAllCompetitorsProvider);
  if (variantId != null) {
    ref.invalidate(catalogComparisonProvider(variantId));
    ref.invalidate(catalogUnlinkedCompetitorsProvider(variantId));
  }
}

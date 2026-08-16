import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_business_vertical.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/conformity_requirement.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/deactivated_facility.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/healthcare_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/support_catalog.dart';
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

/// The same catalogue, **including inactive products** — the admin list only
/// (spec 0016 §4). Separate from [catalogFamiliesProvider] rather than a flag on
/// it, so the rep-facing `/products` list cannot start showing retired products
/// because an admin screen changed its mind.
final adminCatalogFamiliesProvider = FutureProvider<List<CatalogFamily>>((ref) {
  return ref
      .watch(catalogRepositoryProvider)
      .getFamilies(includeInactive: true);
});

/// "Comparativo" for a single AtlasMed variant — that product plus its
/// registered competitor equivalences only.
final catalogComparisonProvider = FutureProvider.family<ComparisonGroup, int>((
  ref,
  variantId,
) {
  return ref.watch(catalogRepositoryProvider).getComparison(variantId);
});

/// Complete Tabela Brasíndice/Simpro — every product in the catalog.
final catalogPriceIndexProvider = FutureProvider<List<ComparisonRow>>((ref) {
  return ref.watch(catalogRepositoryProvider).getFullPriceIndex();
});

/// Every competitor product in the catalog — backs the admin-only
/// "gerenciar outras marcas" picker.
final catalogAllCompetitorsProvider = FutureProvider<List<CompetitorProduct>>((
  ref,
) {
  return ref.watch(catalogRepositoryProvider).getAllCompetitorProducts();
});

/// Every competitor product **including inactive ones** — the admin list only
/// (spec 0016 §4), for the same reason as [adminCatalogFamiliesProvider].
final adminAllCompetitorsProvider = FutureProvider<List<CompetitorProduct>>((
  ref,
) {
  return ref
      .watch(catalogRepositoryProvider)
      .getAllCompetitorProducts(includeInactive: true);
});

/// Fontes pagadoras, inactive included — the admin list only (spec 0016 §4.5).
/// The clinic-side picker reads its own catalogue and keeps filtering to active.
/// The deactivated clinics (spec 0016 §4.8). Not `autoDispose`-scoped by search
/// term: the list is small and the screen filters it in memory, like the other
/// admin lists.
final adminDeactivatedFacilitiesProvider =
    FutureProvider<List<DeactivatedFacility>>((ref) {
      return ref.watch(catalogRepositoryProvider).getDeactivatedFacilities();
    });

final adminHealthcareProvidersProvider =
    FutureProvider<List<HealthcareProvider>>((ref) {
      return ref
          .watch(catalogRepositoryProvider)
          .getHealthcareProviders(includeInactive: true);
    });

/// The cadastro catalogue, inactive included (spec 0016 §4.7) — admin only.
/// Clinic checklists keep reading the active-only endpoint.
final adminConformityRequirementsProvider =
    FutureProvider<List<ConformityRequirement>>((ref) {
      return ref
          .watch(catalogRepositoryProvider)
          .getConformityRequirements(includeInactive: true);
    });

/// One support catalogue, inactive included (spec 0016 §4.6). Keyed by the
/// catalogue so switching segments does not refetch what is already loaded.
final supportCatalogProvider =
    FutureProvider.family<List<SupportCatalogEntry>, SupportCatalog>((
      ref,
      catalog,
    ) {
      return ref
          .watch(catalogRepositoryProvider)
          .getSupportCatalog(catalog, includeInactive: true);
    });

/// Competitor products not yet linked to [variantId] — the "adicionar
/// existente" step of the admin competitor picker.
final catalogUnlinkedCompetitorsProvider =
    FutureProvider.family<List<CompetitorProduct>, int>((ref, variantId) {
      return ref
          .watch(catalogRepositoryProvider)
          .getUnlinkedCompetitors(variantId);
    });

/// Invalidates every catalog read provider — call after any admin
/// mutation (create/update variant, link/unlink competitor) so every
/// screen reading from the repository refetches immediately.
void invalidateCatalog(WidgetRef ref, {int? variantId}) {
  ref.invalidate(catalogFamiliesProvider);
  ref.invalidate(adminCatalogFamiliesProvider);
  ref.invalidate(catalogPriceIndexProvider);
  ref.invalidate(catalogAllCompetitorsProvider);
  ref.invalidate(adminAllCompetitorsProvider);
  if (variantId != null) {
    ref.invalidate(catalogComparisonProvider(variantId));
    ref.invalidate(catalogUnlinkedCompetitorsProvider(variantId));
  }
}

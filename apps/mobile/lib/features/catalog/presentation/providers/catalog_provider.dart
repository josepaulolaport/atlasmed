import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/catalog_models.dart';
import '../../data/catalog_repository.dart';
import '../../data/mock_catalog_repository.dart';

// Swap MockCatalogRepository for ApiCatalogRepository when backend is ready.
final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return MockCatalogRepository();
});

final productFamiliesProvider = FutureProvider<List<ProductFamily>>((ref) {
  return ref.watch(catalogRepositoryProvider).getProductFamilies();
});

final priceTableProvider = FutureProvider<List<PriceTableGroup>>((ref) {
  return ref.watch(catalogRepositoryProvider).getPriceTable();
});

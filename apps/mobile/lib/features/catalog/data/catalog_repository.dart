import 'catalog_models.dart';

/// Abstract repository for catalog data (product families + price table).
///
/// Current implementation: [MockCatalogRepository].
/// Future implementation: `ApiCatalogRepository` (HTTP calls). Swap the
/// provider in `catalog_provider.dart` — screens stay unchanged.
abstract class CatalogRepository {
  Future<List<ProductFamily>> getProductFamilies();
  Future<ProductFamily> getProductFamily(String id);
  Future<List<PriceTableGroup>> getPriceTable();
}

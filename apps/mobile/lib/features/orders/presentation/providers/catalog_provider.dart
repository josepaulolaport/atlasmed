import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/orders/data/catalog_product.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/catalog_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository();
});

class CatalogProductsState {
  const CatalogProductsState({
    this.products = const [],
    this.query = '',
    this.loading = false,
    this.error,
  });

  final List<CatalogProduct> products;
  final String query;
  final bool loading;
  final Object? error;

  CatalogProductsState copyWith({
    List<CatalogProduct>? products,
    String? query,
    bool? loading,
    Object? error,
    bool clearError = false,
  }) => CatalogProductsState(
    products: products ?? this.products,
    query: query ?? this.query,
    loading: loading ?? this.loading,
    error: clearError ? null : (error ?? this.error),
  );
}

class CatalogProductsNotifier extends StateNotifier<CatalogProductsState>
    with DisposeSafeStateWrites<CatalogProductsState> {
  CatalogProductsNotifier(this._repository)
    : super(const CatalogProductsState()) {
    load();
  }

  final CatalogRepository _repository;

  Future<void> load({String? search}) async {
    final query = search?.trim() ?? state.query;
    state = state.copyWith(query: query, loading: true, clearError: true);
    try {
      final page = await _repository.getProducts(
        page: 1,
        limit: 50,
        search: query,
      );
      state = state.copyWith(products: page.products, loading: false);
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }
}

final catalogProductsProvider =
    StateNotifierProvider<CatalogProductsNotifier, CatalogProductsState>((ref) {
      return CatalogProductsNotifier(ref.watch(catalogRepositoryProvider));
    });

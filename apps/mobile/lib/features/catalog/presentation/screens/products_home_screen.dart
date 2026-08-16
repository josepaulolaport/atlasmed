import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/products_product_card.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Produtos (`/products`) — one card per family returned by the catalog API.
/// Presentations are selected on the detail screen.
class ProductsHomeScreen extends ConsumerStatefulWidget {
  const ProductsHomeScreen({super.key});

  @override
  ConsumerState<ProductsHomeScreen> createState() => _ProductsHomeScreenState();
}

class _ProductsHomeScreenState extends ConsumerState<ProductsHomeScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  ProductFamilySort _sort = ProductFamilySort.name;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CatalogFamily> _filtered(List<CatalogFamily> families) {
    final query = _query.trim().toLowerCase();
    final matched = query.isEmpty
        ? [...families]
        : families.where((family) {
            return family.name.toLowerCase().contains(query) ||
                family.manufacturer.toLowerCase().contains(query) ||
                family.countryOfOrigin.toLowerCase().contains(query);
          }).toList();

    switch (_sort) {
      case ProductFamilySort.name:
        matched.sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
      case ProductFamilySort.priceAscending:
        matched.sort((a, b) => a.minPrice.compareTo(b.minPrice));
      case ProductFamilySort.priceDescending:
        matched.sort((a, b) => b.minPrice.compareTo(a.minPrice));
    }
    return matched;
  }

  void _openFamily(CatalogFamily family) {
    ProductDetailRoute(familyId: family.id).push(context);
  }

  @override
  Widget build(BuildContext context) {
    final familiesAsync = ref.watch(catalogFamiliesProvider);
    final filteredFamilies = _filtered(familiesAsync.valueOrNull ?? const []);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Produtos'),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: Text(
                        'Produtos',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navyDeep,
                          letterSpacing: -0.6,
                          height: 1.1,
                        ),
                      ),
                    ),
                  ),
                  // Peer tab to the full Brasíndice/Simpro table. It moved here
                  // from the retired `/catalog` (spec 0016 §3.4), which is why
                  // the table had no way in that a rep could find.
                  const SliverToBoxAdapter(
                    child: CatalogTabBar(active: CatalogTab.produtos),
                  ),
                  SliverToBoxAdapter(
                    child: CatalogSearchBar(
                      controller: _searchController,
                      hintText: 'Buscar produtos…',
                      onChanged: (value) => setState(() => _query = value),
                      // Counted as a filter only when it is not the default,
                      // so the badge means "this list is not in its usual
                      // order" rather than "a sort exists".
                      filterCount: _sort == ProductFamilySort.name ? 0 : 1,
                      onFilter: () => showProductSortSheet(
                        context,
                        current: _sort,
                        onSelect: (sort) => setState(() => _sort = sort),
                      ),
                    ),
                  ),
                  if (!familiesAsync.isLoading &&
                      !familiesAsync.hasError &&
                      filteredFamilies.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                        child: Text(
                          '${filteredFamilies.length} '
                          '${filteredFamilies.length == 1 ? 'produto' : 'produtos'}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.gray500,
                          ),
                        ),
                      ),
                    ),
                  const SliverToBoxAdapter(child: SizedBox(height: 12)),
                  if (familiesAsync.isLoading)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: ProductListSkeleton(),
                      ),
                    )
                  else if (familiesAsync.hasError)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: CatalogErrorState(
                        onRetry: () => ref.invalidate(catalogFamiliesProvider),
                      ),
                    ),
                  if (!familiesAsync.isLoading &&
                      !familiesAsync.hasError &&
                      filteredFamilies.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      // "Nenhum produto encontrado" read the same whether the
                      // catalogue was empty or a search had simply missed —
                      // and only one of those is worth retyping over.
                      child: _ProductsEmptyState(term: _query.trim()),
                    )
                  else if (!familiesAsync.isLoading && !familiesAsync.hasError)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                      sliver: SliverList.separated(
                        itemCount: filteredFamilies.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final family = filteredFamilies[index];
                          return ProductsProductCard(
                            family: family,
                            onTap: () => _openFamily(family),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// An empty catalogue, or a search that missed — said apart.
class _ProductsEmptyState extends StatelessWidget {
  const _ProductsEmptyState({required this.term});

  final String term;

  @override
  Widget build(BuildContext context) {
    final searching = term.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.surfaceSecondary),
            ),
            child: const Icon(
              Icons.medication_liquid_outlined,
              size: 32,
              color: AppColors.navyDeep,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            searching ? 'Nenhum produto encontrado' : 'Catálogo vazio',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            searching
                ? 'Nada corresponde a "$term".'
                : 'Os produtos do catálogo aparecerão aqui.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
        ],
      ),
    );
  }
}

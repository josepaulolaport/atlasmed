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

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CatalogFamily> _filtered(List<CatalogFamily> families) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return families;
    return families.where((family) {
      return family.name.toLowerCase().contains(query) ||
          family.manufacturer.toLowerCase().contains(query) ||
          family.countryOfOrigin.toLowerCase().contains(query);
    }).toList();
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
                  const SliverToBoxAdapter(child: SizedBox(height: 14)),
                  SliverToBoxAdapter(
                    child: CatalogSearchBar(
                      controller: _searchController,
                      hintText: 'Buscar produtos…',
                      onChanged: (value) => setState(() => _query = value),
                      filterCount: 0,
                      onFilter: () {},
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
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          'Nenhum produto encontrado',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.gray400,
                          ),
                        ),
                      ),
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

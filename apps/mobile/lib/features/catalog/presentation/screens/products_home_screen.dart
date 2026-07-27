import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/mock/mock_products_data.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/products_product_card.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

/// Revamped Produtos list (`/produtos`) — one card per family. Concentrations
/// are chosen on the detail screen.
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

  List<MockProductFamily> get _filtered {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return mockProductFamilies;
    return mockProductFamilies.where((family) {
      return family.name.toLowerCase().contains(query) ||
          family.manufacturer.toLowerCase().contains(query) ||
          family.tagline.toLowerCase().contains(query) ||
          family.sector.toLowerCase().contains(query);
    }).toList();
  }

  void _openFamily(MockProductFamily family) {
    context.push('/products/${family.id}');
  }

  @override
  Widget build(BuildContext context) {
    final families = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      appBar: const AtlasAppBar(page: 'Produtos'),
      body: Column(
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
                          color: Color(0xFF0a2f7f),
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
                  if (families.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          'Nenhum produto encontrado',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF9ca3af),
                          ),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                      sliver: SliverList.separated(
                        itemCount: families.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final family = families[index];
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
    );
  }
}

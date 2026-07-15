import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/catalog_product.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/catalog_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/product_order_sheet.dart';

class NewOrderProductsScreen extends ConsumerStatefulWidget {
  const NewOrderProductsScreen({super.key});

  @override
  ConsumerState<NewOrderProductsScreen> createState() =>
      _NewOrderProductsScreenState();
}

class _NewOrderProductsScreenState
    extends ConsumerState<NewOrderProductsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  String _selectedCategory = 'Todos';

  static const _categories = [
    'Todos',
    'Ortopedia',
    'Dermatologia',
    'Cardiologia',
    'Diagnóstico',
    'Suplementação',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _openProductSheet(CatalogProduct product, CartState cart) {
    final cartIndex = cart.items.indexWhere(
      (item) => item.productId == product.id,
    );
    final cartItem = cartIndex >= 0 ? cart.items[cartIndex] : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProductOrderSheet(
        product: product,
        clinicId: cart.clinic?.id,
        clinicName: cart.clinic?.name,
        initialQty: cartItem?.qty ?? 0,
        initialUnit: cartItem?.unitPrice,
        initialMode: cartItem?.priceMode,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final catalog = ref.watch(catalogProductsProvider);
    final products = catalog.products
        .where(
          (p) =>
              _selectedCategory == 'Todos' || p.category == _selectedCategory,
        )
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(cart),
            if (cart.clinic != null) _buildClinicStrip(cart),
            _buildSearchBar(),
            _buildCategoryChips(),
            Expanded(
              child: catalog.loading
                  ? const Center(child: CircularProgressIndicator())
                  : catalog.error != null
                  ? _CatalogErrorState(
                      onRetry: () =>
                          ref.read(catalogProductsProvider.notifier).load(),
                    )
                  : products.isEmpty
                  ? const _EmptyState()
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                      itemCount: products.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final product = products[index];
                        final cartIndex = cart.items.indexWhere(
                          (item) => item.productId == product.id,
                        );
                        final cartItem = cartIndex >= 0
                            ? cart.items[cartIndex]
                            : null;
                        return _ProductCard(
                          product: product,
                          cartItem: cartItem,
                          onTap: () => _openProductSheet(product, cart),
                          onAdd: () => _openProductSheet(product, cart),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: cart.totalQty > 0
          ? Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: SizedBox(
                width: double.infinity,
                child: FloatingActionButton.extended(
                  heroTag: 'new-order-products-cta',
                  backgroundColor: const Color(0xFF0a2f7f),
                  foregroundColor: Colors.white,
                  onPressed: () => context.push('/pedidos/novo/carrinho'),
                  label: Text('Ver carrinho · ${cart.totalQty} itens →'),
                ),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildHeader(CartState cart) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          const BackChevron(),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NOVO PEDIDO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6b7280),
                    letterSpacing: 0.8,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Produtos',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0a2f7f),
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
          CartBadge(
            totalQty: cart.totalQty,
            totalValue: cart.subtotal,
            onTap: () => context.push('/pedidos/novo/carrinho'),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicStrip(CartState cart) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFeef2ff),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0x1F0a2f7f), width: 1.2),
        ),
        child: Row(
          children: [
            const Text('🏥', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Pedido para · ${cart.clinic!.name}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0a2f7f),
                ),
              ),
            ),
            GestureDetector(
              onTap: () {},
              child: const Text(
                'Trocar',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1e40af),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final focused = _searchFocusNode.hasFocus;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Focus(
        onFocusChange: (_) => setState(() {}),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: focused
                  ? const Color(0xFF0a2f7f)
                  : const Color(0xFFd8dee9),
              width: 1.5,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          child: TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            textInputAction: TextInputAction.search,
            onSubmitted: (query) =>
                ref.read(catalogProductsProvider.notifier).load(search: query),
            decoration: const InputDecoration(
              icon: Icon(Icons.search, size: 20, color: Color(0xFF9ca3af)),
              hintText: 'Buscar produto…',
              border: InputBorder.none,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final active = cat == _selectedCategory;
          return ChoiceChip(
            label: Text(cat),
            selected: active,
            onSelected: (_) => setState(() => _selectedCategory = cat),
            labelStyle: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: active ? Colors.white : const Color(0xFF6b7280),
            ),
            selectedColor: const Color(0xFF0a2f7f),
            backgroundColor: Colors.white,
            side: const BorderSide(color: Color(0xFFd8dee9), width: 1),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
            ),
          );
        },
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemCount: _categories.length,
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final CatalogProduct product;
  final CartItem? cartItem;
  final VoidCallback onTap;
  final VoidCallback onAdd;

  const _ProductCard({
    required this.product,
    required this.cartItem,
    required this.onTap,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final inCart = cartItem != null && cartItem!.qty > 0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: inCart ? const Color(0xFF0a2f7f) : const Color(0xFFd8dee9),
            width: 1.5,
          ),
          boxShadow: inCart
              ? [
                  BoxShadow(
                    color: const Color(0x140a2f7f),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            ProductIcon(name: product.name, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0f1729),
                          ),
                        ),
                      ),
                      PTag(tag: null),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    product.subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    brl(product.price),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0a2f7f),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (inCart)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0x1F16a373),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${cartItem!.qty}× no carrinho',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f8a5f),
                  ),
                ),
              )
            else
              GestureDetector(
                onTap: onAdd,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: const BoxDecoration(
                    color: Color(0xFFeef2ff),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.add,
                    size: 18,
                    color: Color(0xFF0a2f7f),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CatalogErrorState extends StatelessWidget {
  const _CatalogErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: TextButton.icon(
      onPressed: onRetry,
      icon: const Icon(Icons.refresh),
      label: const Text(
        'Não foi possível carregar os produtos. Tentar novamente',
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        'Nenhum produto encontrado',
        style: TextStyle(
          fontSize: 14,
          color: Color(0xFF6b7280),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

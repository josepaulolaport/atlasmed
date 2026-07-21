import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/mock/mock_products_data.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

enum _ProductDetailTab { overview, use, evidence, competitors }

/// Product detail for the revamped Produtos flow. Opened by family; the
/// concentration switcher picks which [MockProduct] is active. Overview only
/// for now.
class ProductDetailScreen extends StatefulWidget {
  final String familyId;

  const ProductDetailScreen({super.key, required this.familyId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  late final List<MockProduct> _familyProducts = mockProductsInFamily(
    widget.familyId,
  );
  late String _selectedProductId = _familyProducts.isEmpty
      ? ''
      : _familyProducts.first.id;
  _ProductDetailTab _tab = _ProductDetailTab.overview;

  MockProductFamily? get _family => mockFamilyById(widget.familyId);

  MockProduct? get _product =>
      _selectedProductId.isEmpty ? null : mockProductById(_selectedProductId);

  @override
  Widget build(BuildContext context) {
    final family = _family;
    final product = _product;
    if (family == null || product == null || _familyProducts.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFf7f8fb),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
                child: Row(
                  children: [
                    BackChevron(onTap: () => context.pop()),
                    const SizedBox(width: 8),
                    const Text(
                      'Produto',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0a2f7f),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CatalogErrorState(
                  message: 'Produto não encontrado',
                  onRetry: () => context.pop(),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 4),
              child: Row(
                children: [
                  BackChevron(onTap: () => context.pop()),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      family.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0a2f7f),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_familyProducts.length > 1)
              _ConcentrationSwitcher(
                products: _familyProducts,
                selectedId: product.id,
                onSelected: (id) => setState(() {
                  _selectedProductId = id;
                  _tab = _ProductDetailTab.overview;
                }),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                physics: const BouncingScrollPhysics(),
                children: [
                  _HeroCard(product: product),
                  const SizedBox(height: 14),
                  _TabBar(
                    active: _tab,
                    onChanged: (tab) => setState(() => _tab = tab),
                  ),
                  const SizedBox(height: 14),
                  if (_tab == _ProductDetailTab.overview)
                    _OverviewTab(product: product)
                  else
                    _ComingSoonTab(tab: _tab),
                ],
              ),
            ),
            _CompareButton(product: product),
          ],
        ),
      ),
    );
  }
}

class _ConcentrationSwitcher extends StatelessWidget {
  final List<MockProduct> products;
  final String selectedId;
  final ValueChanged<String> onSelected;

  const _ConcentrationSwitcher({
    required this.products,
    required this.selectedId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFe5e7eb)),
        ),
        child: Row(
          children: [
            for (final product in products)
              Expanded(
                child: GestureDetector(
                  onTap: () => onSelected(product.id),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: product.id == selectedId
                          ? const Color(0xFF0a2f7f)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      product.presentation,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: product.id == selectedId
                            ? Colors.white
                            : const Color(0xFF0a2f7f),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  final MockProduct product;

  const _HeroCard({required this.product});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0a2f7f),
                    letterSpacing: -0.3,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  product.tagline,
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: Color(0xFF6b7280),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (product.isInHouse)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0d9488),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'Próprio',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFeef2ff),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFc7d2fe)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.account_tree_outlined,
                            size: 13,
                            color: Color(0xFF1e40af),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${product.competitorMatchCount} concorrentes',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1e40af),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 88,
            height: 96,
            decoration: BoxDecoration(
              color: const Color(0xFFf7f8fb),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFeef0f3)),
            ),
            child: const Icon(
              Icons.medication_liquid_outlined,
              size: 40,
              color: Color(0xFFc8cdd5),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  final _ProductDetailTab active;
  final ValueChanged<_ProductDetailTab> onChanged;

  const _TabBar({required this.active, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const tabs = [
      (_ProductDetailTab.overview, 'Visão geral'),
      (_ProductDetailTab.use, 'Uso'),
      (_ProductDetailTab.evidence, 'Evidências'),
      (_ProductDetailTab.competitors, 'Concorrentes'),
    ];

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFe5e7eb))),
      ),
      child: Row(
        children: [
          for (final (tab, label) in tabs)
            Expanded(
              child: InkWell(
                onTap: () => onChanged(tab),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: tab == active
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: tab == active
                              ? const Color(0xFF0a2f7f)
                              : const Color(0xFF9ca3af),
                        ),
                      ),
                    ),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      height: 2.5,
                      decoration: BoxDecoration(
                        color: tab == active
                            ? const Color(0xFF0a2f7f)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  final MockProduct product;

  const _OverviewTab({required this.product});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionCard(
          title: 'Sobre o produto',
          child: Text(
            product.overview,
            style: const TextStyle(
              fontSize: 13.5,
              height: 1.45,
              color: Color(0xFF374151),
            ),
          ),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Informações',
          child: Column(
            children: [
              _InfoRow(label: 'Concentração', value: product.presentation),
              const _InfoDivider(),
              _InfoRow(label: 'Fabricante', value: product.manufacturer),
              const _InfoDivider(),
              _InfoRow(label: 'País de origem', value: product.countryOfOrigin),
              const _InfoDivider(),
              _InfoRow(label: 'Setor', value: product.sector),
              const _InfoDivider(),
              _InfoRow(label: 'Preço', value: brl(product.price)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Códigos',
          child: Column(
            children: [
              _InfoRow(label: 'SIMPRO', value: product.simproCode),
              const _InfoDivider(),
              _InfoRow(label: 'BRASÍNDICE', value: product.brasindiceCode),
              const _InfoDivider(),
              _InfoRow(label: 'TISS', value: product.tissCode),
            ],
          ),
        ),
      ],
    );
  }
}

class _ComingSoonTab extends StatelessWidget {
  final _ProductDetailTab tab;

  const _ComingSoonTab({required this.tab});

  String get _label => switch (tab) {
    _ProductDetailTab.use => 'Uso',
    _ProductDetailTab.evidence => 'Evidências',
    _ProductDetailTab.competitors => 'Concorrentes',
    _ProductDetailTab.overview => 'Visão geral',
  };

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: _label,
      child: Text(
        'Conteúdo de $_label em breve.',
        style: const TextStyle(fontSize: 13.5, color: Color(0xFF6b7280)),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0a2f7f),
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoDivider extends StatelessWidget {
  const _InfoDivider();

  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, thickness: 1, color: Color(0xFFeef0f3));
  }
}

class _CompareButton extends StatelessWidget {
  final MockProduct product;

  const _CompareButton({required this.product});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Comparar ${product.name} — em breve'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            icon: const Icon(Icons.balance_rounded, size: 18),
            label: Text(
              'Comparar ${product.name}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0a2f7f),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              textStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

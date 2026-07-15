import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/tracking.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  static const _bg = Color(0xFFf7f8fb);
  static const _navy = Color(0xFF0a2f7f);
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final items = cart.items;
    final subtotal = cart.subtotal;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              totalQty: cart.totalQty,
              onBack: () => Navigator.of(context).pop(),
            ),
            Expanded(
              child: cart.items.isEmpty
                  ? _EmptyState(onBackToProducts: () => context.pop())
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      children: [
                        ...items.map(
                          (entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _CartItemCard(
                              item: entry,
                              onChanged: (newQty) {
                                ref
                                    .read(cartProvider.notifier)
                                    .updateQty(entry.productId, newQty);
                              },
                            ),
                          ),
                        ),
                        _SummaryCard(items: items, subtotal: subtotal),
                        const SizedBox(height: 16),
                      ],
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: cart.items.isEmpty
                      ? null
                      : () => context.push('/pedidos/novo/checkout'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _navy,
                    disabledBackgroundColor: _navy.withValues(alpha: 0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Finalizar pedido',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
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

class _Header extends StatelessWidget {
  final int totalQty;
  final VoidCallback onBack;

  const _Header({required this.totalQty, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          BackChevron(onTap: onBack),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'NOVO PEDIDO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF9ca3af),
                    letterSpacing: 0.7,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Text(
                      'Carrinho',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0a2f7f),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '$totalQty itens',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF9ca3af),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CartItemCard extends StatelessWidget {
  final CartItem item;
  final ValueChanged<int> onChanged;

  const _CartItemCard({required this.item, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Row(
        children: [
          ProductIcon(name: item.productName, size: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1f2937),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.productSubtitle,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF6b7280),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  brl(item.unitPrice * item.qty),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0a2f7f),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          StepperWidget(value: item.qty, onChange: onChanged),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final List<CartItem> items;
  final double subtotal;

  const _SummaryCard({required this.items, required this.subtotal});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Resumo',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1f2937),
            ),
          ),
          const SizedBox(height: 12),
          ...items.map((item) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${item.productName} × ${item.qty}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF6b7280),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Text(
                    brl(item.unitPrice * item.qty),
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF1f2937),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          }),
          const Divider(height: 20, color: Color(0xFFeef0f3)),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Total',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1f2937),
                  ),
                ),
              ),
              Text(
                brl(subtotal),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0a2f7f),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onBackToProducts;

  const _EmptyState({required this.onBackToProducts});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Carrinho vazio',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1f2937),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 46,
              child: ElevatedButton(
                onPressed: onBackToProducts,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0a2f7f),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Voltar aos produtos',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
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

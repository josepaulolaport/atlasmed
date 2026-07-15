import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/app_shell.dart';
import '../../data/models.dart';
import '../../data/mock_orders_repository.dart';
import '../widgets/order_widgets.dart';

class MeusOrdersScreen extends ConsumerStatefulWidget {
  const MeusOrdersScreen({super.key});

  @override
  ConsumerState<MeusOrdersScreen> createState() => _MeusOrdersScreenState();
}

class _MeusOrdersScreenState extends ConsumerState<MeusOrdersScreen> {
  String selectedFilter = 'Todos';

  static const _filters = <String>[
    'Todos',
    'Em trânsito',
    'Pendente',
    'Entregue',
    'Cancelado',
  ];

  @override
  Widget build(BuildContext context) {
    final orders = kOrdersList.where((order) {
      if (selectedFilter == 'Todos') return true;
      return order.status.label.toLowerCase() == selectedFilter.toLowerCase();
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                const AtlasTopBar(page: 'Pedidos'),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                    children: [
                      const Text(
                        'Meus Pedidos',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0a2f7f),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _SummaryStrip(
                        transitCount: 1,
                        pendingCount: 1,
                        deliveredCount: 2,
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _filters.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(width: 10),
                          itemBuilder: (context, index) {
                            final filter = _filters[index];
                            final selected = filter == selectedFilter;
                            return _FilterChip(
                              label: filter,
                              selected: selected,
                              onTap: () =>
                                  setState(() => selectedFilter = filter),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (orders.isEmpty)
                        const _EmptyState()
                      else
                        ...orders.map(
                          (order) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _OrderCard(
                              order: order,
                              onTap: () => context.push('/pedidos/${order.id}'),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: SizedBox(
                    height: 54,
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () => context.go('/pedidos/novo'),
                      icon: const Icon(Icons.add_rounded, size: 20),
                      label: const Text(
                        'Novo pedido',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0a2f7f),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
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

class _SummaryStrip extends StatelessWidget {
  final int transitCount;
  final int pendingCount;
  final int deliveredCount;

  const _SummaryStrip({
    required this.transitCount,
    required this.pendingCount,
    required this.deliveredCount,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _SummaryCard(
            label: 'Em trânsito',
            count: transitCount,
            color: const Color(0xFF0a2f7f),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Pendentes',
            count: pendingCount,
            color: const Color(0xFFc6861b),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Entregues',
            count: deliveredCount,
            color: const Color(0xFF16a373),
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _SummaryCard({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF6b7280),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF0a2f7f) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFeef0f3)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const Color(0xFF6b7280),
          ),
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final OrderListItem order;
  final VoidCallback onTap;

  const _OrderCard({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFeef0f3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${order.id} • ${order.date}',
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF9ca3af),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              order.clinic,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1f2937),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              order.doctor,
              style: const TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
            ),
            const SizedBox(height: 10),
            PStatusChip(status: order.status),
            const SizedBox(height: 12),
            const Divider(height: 1, thickness: 1, color: Color(0xFFeef0f3)),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  '${order.items} itens · toque para detalhes',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF9ca3af),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Text(
                  order.value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0a2f7f),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.all(Radius.circular(20)),
              border: Border.fromBorderSide(
                BorderSide(color: Color(0xFFeef0f3)),
              ),
            ),
            child: Icon(
              Icons.shopping_bag_outlined,
              size: 32,
              color: Color(0xFF0a2f7f),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Nenhum pedido ainda',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1f2937),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Toque em “Novo pedido” para começar.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class MyOrdersScreen extends ConsumerStatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  ConsumerState<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends ConsumerState<MyOrdersScreen> {
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
    final statuses = _apiStatusesFor(selectedFilter);
    final ordersAsync = ref.watch(meusOrdersProvider(statuses));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                    children: [
                      const Text(
                        'Meus Pedidos',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: AppColors.navyDeep,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _SummaryStrip(
                        transitCount:
                            ordersAsync.valueOrNull
                                ?.where(
                                  (order) =>
                                      order.status == OrderStatus.approved,
                                )
                                .length ??
                            0,
                        pendingCount:
                            ordersAsync.valueOrNull
                                ?.where(
                                  (order) =>
                                      order.status == OrderStatus.pending,
                                )
                                .length ??
                            0,
                        deliveredCount:
                            ordersAsync.valueOrNull
                                ?.where(
                                  (order) =>
                                      order.status == OrderStatus.invoiced,
                                )
                                .length ??
                            0,
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
                      ...ordersAsync.when(
                        loading: () => const [OrderListSkeleton()],
                        error: (_, _) => const [
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 32),
                            child: Center(
                              child: Text(
                                'Não foi possível carregar os pedidos.',
                              ),
                            ),
                          ),
                        ],
                        data: (orders) => orders.isEmpty
                            ? const [_EmptyState()]
                            : orders
                                  .map(
                                    (order) => Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 12,
                                      ),
                                      child: _OrderCard(
                                        order: order,
                                        onTap: () =>
                                            context.push('/orders/${order.id}'),
                                      ),
                                    ),
                                  )
                                  .toList(growable: false),
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
                      onPressed: () => context.go('/orders/new'),
                      icon: const Icon(Icons.add_rounded, size: 20),
                      label: const Text(
                        'Novo pedido',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.navyDeep,
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

List<String>? _apiStatusesFor(String filter) {
  switch (filter) {
    case 'Em trânsito':
      return const ['SHIPPED'];
    case 'Pendente':
      return const ['DRAFT', 'PENDING'];
    case 'Entregue':
      return const ['DELIVERED'];
    case 'Cancelado':
      return const ['CANCELLED', 'REJECTED'];
    default:
      return null;
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
            color: AppColors.navyDeep,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Pendentes',
            count: pendingCount,
            color: AppColors.amber,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Entregues',
            count: deliveredCount,
            color: AppColors.green,
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
        border: Border.all(color: AppColors.surfaceSecondary),
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
              color: AppColors.gray500,
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
          color: selected ? AppColors.navyDeep : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.gray500,
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
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${order.id} • ${order.date}',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.gray400,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              order.clinic,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.gray800,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              order.doctor,
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            const SizedBox(height: 10),
            PStatusChip(status: order.status),
            const SizedBox(height: 12),
            const Divider(
              height: 1,
              thickness: 1,
              color: AppColors.surfaceSecondary,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Text(
                  '${order.items} itens · toque para detalhes',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Text(
                  order.value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
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
                BorderSide(color: AppColors.surfaceSecondary),
              ),
            ),
            child: Icon(
              Icons.shopping_bag_outlined,
              size: 32,
              color: AppColors.navyDeep,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Nenhum pedido ainda',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Toque em “Novo pedido” para começar.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
        ],
      ),
    );
  }
}

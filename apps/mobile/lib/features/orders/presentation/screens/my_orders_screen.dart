import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

class MyOrdersScreen extends ConsumerStatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  ConsumerState<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

/// The order statuses that exist, and the words for them.
///
/// The chips used to send SHIPPED, DELIVERED and CANCELLED — none of which are
/// in the `order_status` enum, so three of the five tabs failed validation and
/// showed the error state rather than a list. The vocabulary is the database's
/// now: DRAFT, PENDING, APPROVED, INVOICED, REJECTED, NO_BILLING.
class _OrderFilter {
  const _OrderFilter(this.label, this.statuses);

  final String label;

  /// Null means every status.
  final List<String>? statuses;
}

const _filters = <_OrderFilter>[
  _OrderFilter('Todos', null),
  _OrderFilter('Faturados', ['INVOICED']),
  _OrderFilter('Sem faturamento', ['NO_BILLING']),
  _OrderFilter('Pendentes', ['DRAFT', 'PENDING']),
  _OrderFilter('Aprovados', ['APPROVED']),
  _OrderFilter('Rejeitados', ['REJECTED']),
];

class _MyOrdersScreenState extends ConsumerState<MyOrdersScreen> {
  final _scrollController = ScrollController();
  String selectedFilter = 'Todos';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Fetches the next page while the rep is still 600px from the bottom, so
  /// the list grows before they reach the end of it.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 600) {
      ref.read(ordersListProvider.notifier).loadMore();
    }
  }

  void _selectFilter(_OrderFilter filter) {
    if (filter.label == selectedFilter) return;
    setState(() => selectedFilter = filter.label);
    ref.read(ordersListProvider.notifier).setStatuses(filter.statuses);
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(ordersListProvider);
    final listState = ordersAsync.valueOrNull;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Pedidos'),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(ordersListProvider.notifier).refresh(),
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    const Text(
                      'Meus Pedidos',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navyDeep,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _SummaryStrip(counts: listState?.statusCounts ?? const {}),
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
                          return _FilterChip(
                            label: filter.label,
                            selected: filter.label == selectedFilter,
                            onTap: () => _selectFilter(filter),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (listState != null && listState.orders.isNotEmpty)
                      _ResultCount(
                        shown: listState.orders.length,
                        total: listState.total,
                      ),
                    const SizedBox(height: 8),
                  ]),
                ),
              ),
              ...ordersAsync.when(
                loading: () => const [
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverToBoxAdapter(child: OrderListSkeleton()),
                  ),
                ],
                error: (_, _) => const [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Text('Não foi possível carregar os pedidos.'),
                      ),
                    ),
                  ),
                ],
                data: (state) => state.orders.isEmpty
                    ? const [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: _EmptyState(),
                          ),
                        ),
                      ]
                    : [
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          // Builder, not a materialized list: 1131 orders can
                          // all end up here now that the list pages.
                          sliver: SliverList.separated(
                            itemCount: state.orders.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final order = state.orders[index];
                              return _OrderCard(
                                order: order,
                                onTap: () => OrderDetailRoute(
                                  id: order.id,
                                ).push(context),
                              );
                            },
                          ),
                        ),
                        SliverToBoxAdapter(
                          child: _ListFooter(
                            isLoadingMore: state.isLoadingMore,
                            hasMore: state.hasMore,
                          ),
                        ),
                      ],
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 120)),
            ],
          ),
        ),
      ),
    );
  }
}

/// "20 de 1131 pedidos" — the count the screen could never show before, since
/// it discarded `pagination` and had no way to say more existed.
class _ResultCount extends StatelessWidget {
  const _ResultCount({required this.shown, required this.total});

  final int shown;
  final int total;

  @override
  Widget build(BuildContext context) {
    final text = shown >= total
        ? '$total ${total == 1 ? 'pedido' : 'pedidos'}'
        : '$shown de $total pedidos';
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        color: AppColors.gray500,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.isLoadingMore, required this.hasMore});

  final bool isLoadingMore;
  final bool hasMore;

  @override
  Widget build(BuildContext context) {
    if (isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (hasMore) return const SizedBox(height: 20);
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(
          'Fim da lista',
          style: TextStyle(fontSize: 12, color: AppColors.gray400),
        ),
      ),
    );
  }
}

/// Totals for the whole scoped set, from the API.
///
/// These were counted from the loaded page, and mislabelled on top of it:
/// APPROVED read "Em trânsito" and INVOICED read "Entregue", neither of which
/// is what those statuses mean. Nothing in the system tracks a delivery.
class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.counts});

  final Map<String, int> counts;

  @override
  Widget build(BuildContext context) {
    final pending = (counts['DRAFT'] ?? 0) + (counts['PENDING'] ?? 0);
    return Row(
      children: [
        Expanded(
          child: _SummaryCard(
            label: 'Faturados',
            count: counts['INVOICED'] ?? 0,
            color: AppColors.green,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Sem faturamento',
            count: counts['NO_BILLING'] ?? 0,
            color: AppColors.navyDeep,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryCard(
            label: 'Pendentes',
            count: pending,
            color: AppColors.amber,
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
              // PED-1234 for an imported order — the number a rep reads back
              // over the phone. This was the raw database id.
              '${order.displayId} • ${order.date}',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.gray400,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              order.clinic,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.gray800,
              ),
            ),
            if (order.seller != null) ...[
              const SizedBox(height: 3),
              Text(
                order.seller!,
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            ],
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
            'Os pedidos registrados aparecerão aqui.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
        ],
      ),
    );
  }
}

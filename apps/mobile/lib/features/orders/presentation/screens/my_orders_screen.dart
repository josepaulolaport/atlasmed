import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_clinic_filter_sheet.dart';
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

  /// Tapping the card for the filter already applied clears it, so the strip
  /// is a way back to everything and not a one-way trip.
  void _selectFilterByLabel(String label) {
    final target = label == selectedFilter ? 'Todos' : label;
    _selectFilter(_filters.firstWhere((filter) => filter.label == target));
  }

  Future<void> _pickClinic(OrderFacilityFilter? current) async {
    final chosen = await showOrderClinicFilterSheet(context, current: current);
    if (chosen == null || !mounted) return;
    await ref
        .read(ordersListProvider.notifier)
        .setFacility(chosen.id == 0 ? null : chosen);
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
                    _SummaryStrip(
                      counts: listState?.statusCounts ?? const {},
                      selectedFilter: selectedFilter,
                      onSelect: _selectFilterByLabel,
                    ),
                    const SizedBox(height: 18),
                    _ClinicFilterRow(
                      facility: listState?.facility,
                      onTap: () => _pickClinic(listState?.facility),
                      onClear: listState?.facility == null
                          ? null
                          : () => ref
                                .read(ordersListProvider.notifier)
                                .setFacility(null),
                    ),
                    const SizedBox(height: 12),
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
                    ? [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: _EmptyState(
                              facility: state.facility,
                              statusLabel: selectedFilter == 'Todos'
                                  ? null
                                  : selectedFilter,
                            ),
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
/// Search for a clinic, or say which one the list is currently narrowed to.
///
/// A row of its own rather than another status chip: it answers a different
/// question ("which clinic") from the ones beside it ("which state"), and the
/// two combine — a clinic's rejected orders is a reasonable thing to ask for.
class _ClinicFilterRow extends StatelessWidget {
  const _ClinicFilterRow({
    required this.facility,
    required this.onTap,
    this.onClear,
  });

  final OrderFacilityFilter? facility;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final selected = facility != null;
    return Material(
      color: selected ? AppColors.blue50 : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        key: const Key('orders-clinic-filter'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.navyBright : AppColors.gray200,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected ? Icons.local_hospital_rounded : Icons.search_rounded,
                size: 18,
                color: selected ? AppColors.navyBright : AppColors.gray400,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  facility?.name ?? 'Buscar pedidos de uma clínica',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    color: selected ? AppColors.navyDeep : AppColors.gray500,
                  ),
                ),
              ),
              if (onClear != null)
                IconButton(
                  key: const Key('orders-clinic-filter-clear'),
                  tooltip: 'Mostrar pedidos de todas as clínicas',
                  onPressed: onClear,
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: AppColors.navyBright,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

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
///
/// Each card carries the same label as one of the chips below it, so tapping
/// the number applies that chip. They were inert before, which made three
/// button-shaped things on the busiest screen in the app do nothing.
class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({
    required this.counts,
    required this.selectedFilter,
    required this.onSelect,
  });

  final Map<String, int> counts;
  final String selectedFilter;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final pending = (counts['DRAFT'] ?? 0) + (counts['PENDING'] ?? 0);
    // IntrinsicHeight, not a bare stretch: this Row sits in a sliver with no
    // height to inherit, so `CrossAxisAlignment.stretch` alone hands the cards
    // h=Infinity and the screen throws on layout.
    return IntrinsicHeight(
      child: Row(
        // "Sem faturamento" wraps to two lines and the other two do not, so
        // the cards were three different heights on a shared baseline.
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _SummaryCard(
              label: 'Faturados',
              count: counts['INVOICED'] ?? 0,
              color: AppColors.green,
              selected: selectedFilter == 'Faturados',
              onTap: () => onSelect('Faturados'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _SummaryCard(
              label: 'Sem faturamento',
              count: counts['NO_BILLING'] ?? 0,
              color: AppColors.navyDeep,
              selected: selectedFilter == 'Sem faturamento',
              onTap: () => onSelect('Sem faturamento'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _SummaryCard(
              label: 'Pendentes',
              count: pending,
              color: AppColors.amber,
              selected: selectedFilter == 'Pendentes',
              onTap: () => onSelect('Pendentes'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const _SummaryCard({
    required this.label,
    required this.count,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        key: Key('orders-summary-$label'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? color : AppColors.surfaceSecondary,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                  color: color,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1.2,
                  color: selected ? AppColors.gray700 : AppColors.gray500,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
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

  /// "Adriana Oliveira · 1 item", or whichever half exists.
  ///
  /// "1 itens" before, and the count sat on a line of its own under a divider.
  String get _subtitle => [
    if (order.seller != null) order.seller!,
    '${order.items} ${order.items == 1 ? 'item' : 'itens'}',
  ].join(' · ');

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          // Three rows, not five. The status chip and the item count each had
          // a line to themselves — with a divider between — so twenty orders
          // was a very long scroll for very little on it.
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      // PED-1234 for an imported order — the number a rep
                      // reads back over the phone. This was the database id.
                      '${order.displayId} · ${order.date}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.gray400,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PStatusChip(status: order.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                order.clinic,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.25,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      _subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    order.value,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyDeep,
                    ),
                  ),
                  // A chevron rather than "toque para detalhes" printed on
                  // every card — the house signal for a row that opens.
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: AppColors.gray400,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Says why the list is empty.
///
/// It read "Nenhum pedido ainda / Os pedidos registrados aparecerão aqui"
/// whatever was in effect, so a clinic with no rejected orders looked like a
/// rep with no orders at all.
class _EmptyState extends StatelessWidget {
  const _EmptyState({this.facility, this.statusLabel});

  final OrderFacilityFilter? facility;

  /// The chip in effect, or null when it is "Todos".
  final String? statusLabel;

  String get _title {
    if (facility == null && statusLabel == null) return 'Nenhum pedido ainda';
    return 'Nenhum pedido encontrado';
  }

  String get _subtitle {
    final status = statusLabel?.toLowerCase();
    if (facility != null && status != null) {
      return 'Nenhum pedido "$status" para ${facility!.name}.';
    }
    if (facility != null) {
      return 'Nenhum pedido registrado para ${facility!.name}.';
    }
    if (status != null) return 'Nenhum pedido "$status" no seu território.';
    return 'Os pedidos registrados aparecerão aqui.';
  }

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
          Text(
            _title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
        ],
      ),
    );
  }
}

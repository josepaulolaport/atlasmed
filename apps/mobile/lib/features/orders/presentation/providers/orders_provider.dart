import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) {
  return OrdersRepository(baseUrl: AppConfig.apiBaseUrl);
});

final orderDetailProvider = FutureProvider.family<ApiOrderDetail, int>((
  ref,
  orderId,
) {
  return ref.watch(ordersRepositoryProvider).getOrder(orderId);
});

OrderStatus _orderStatusFromApi(String status) => orderStatusFromJson(status);

String _formatDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
String formatOrderCurrency(double value) =>
    'R\$ ${value.toStringAsFixed(2).replaceAll('.', ',')}';

/// How many orders one request asks for. The route ceilings this at 100.
const int ordersPageSize = 20;

/// The list, its paging state and the status tallies behind the summary strip.
///
/// The screen fetched exactly one page of 20 before and dropped `pagination`
/// on the floor, so on 1131 orders it showed 20 with nothing to say more
/// existed — no next page, no total, no way to reach order 21.
/// The clinic the list is narrowed to, and what to call it on the chip.
class OrderFacilityFilter {
  const OrderFacilityFilter({required this.id, required this.name});

  final int id;
  final String name;
}

class OrdersListState {
  const OrdersListState({
    this.orders = const [],
    this.statusCounts = const {},
    this.total = 0,
    this.page = 0,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.facility,
  });

  final List<OrderListItem> orders;

  /// Across the whole scoped set, unaffected by the status filter, so the
  /// tallies hold still as the rep switches tabs.
  final Map<String, int> statusCounts;
  final int total;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  /// Null when the list is showing every clinic in scope.
  final OrderFacilityFilter? facility;

  OrdersListState copyWith({
    List<OrderListItem>? orders,
    Map<String, int>? statusCounts,
    int? total,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
    OrderFacilityFilter? facility,
  }) => OrdersListState(
    orders: orders ?? this.orders,
    statusCounts: statusCounts ?? this.statusCounts,
    total: total ?? this.total,
    page: page ?? this.page,
    hasMore: hasMore ?? this.hasMore,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    facility: facility ?? this.facility,
  );
}

OrderListItem _listItemForApi(ApiOrderListItem order) => OrderListItem(
  id: order.id,
  displayId: order.displayId,
  clinic: order.facility.name,
  seller: order.seller?.name,
  date: _formatDate(order.orderedAt ?? order.createdAt),
  value: formatOrderCurrency(order.total),
  status: _orderStatusFromApi(order.status),
  items: order.itemCount,
);

class OrdersListNotifier extends AsyncNotifier<OrdersListState> {
  List<String>? _statuses;
  int? _facilityId;

  @override
  Future<OrdersListState> build() => _loadFirstPage();

  Future<OrdersListState> _loadFirstPage() async {
    final page = await ref
        .read(ordersRepositoryProvider)
        .listOrders(
          page: 1,
          limit: ordersPageSize,
          statuses: _statuses,
          facilityId: _facilityId,
        );
    return OrdersListState(
      orders: page.data.map(_listItemForApi).toList(growable: false),
      statusCounts: page.statusCounts,
      total: page.total,
      page: page.page,
      hasMore: page.hasNextPage,
      facility: _facility,
    );
  }

  /// Re-queries from page 1. The accumulated pages belong to the old filter,
  /// so they go rather than being appended to.
  Future<void> setStatuses(List<String>? statuses) async {
    _statuses = statuses;
    state = const AsyncLoading();
    state = await AsyncValue.guard(_loadFirstPage);
  }

  /// Narrows the list to one clinic, or widens it again with null.
  ///
  /// The name is carried alongside the id so the chip can say which clinic
  /// without the list having to find it again.
  OrderFacilityFilter? _facility;

  Future<void> setFacility(OrderFacilityFilter? facility) async {
    if (facility?.id == _facilityId) return;
    _facility = facility;
    _facilityId = facility?.id;
    state = const AsyncLoading();
    state = await AsyncValue.guard(_loadFirstPage);
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_loadFirstPage);
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    // Guarded against the scroll notifier firing repeatedly at the threshold:
    // without `isLoadingMore` the same page is requested several times and
    // appended several times.
    if (current == null || !current.hasMore || current.isLoadingMore) return;

    state = AsyncData(current.copyWith(isLoadingMore: true));
    try {
      final next = await ref
          .read(ordersRepositoryProvider)
          .listOrders(
            page: current.page + 1,
            limit: ordersPageSize,
            statuses: _statuses,
            facilityId: _facilityId,
          );
      state = AsyncData(
        current.copyWith(
          orders: [...current.orders, ...next.data.map(_listItemForApi)],
          statusCounts: next.statusCounts,
          total: next.total,
          page: next.page,
          hasMore: next.hasNextPage,
          isLoadingMore: false,
        ),
      );
    } catch (_) {
      // Keep what is already on screen; the next scroll retries.
      state = AsyncData(current.copyWith(isLoadingMore: false));
    }
  }
}

final ordersListProvider =
    AsyncNotifierProvider<OrdersListNotifier, OrdersListState>(
      OrdersListNotifier.new,
    );

OrderDetail orderDetailForApi(ApiOrderDetail order) => OrderDetail(
  id: order.id,
  displayId: order.displayId,
  placedAt: _formatDate(order.orderedAt ?? order.createdAt),
  updatedAt: _formatDate(order.updatedAt),
  clinic: order.facility.name,
  facilityId: order.facility.id,
  seller: order.seller?.name,
  status: _orderStatusFromApi(order.status),
  type: order.type,
  notes: (order.notes?.trim().isEmpty ?? true) ? null : order.notes!.trim(),
  currency: order.currency,
  items: order.items
      .map(
        (item) => OrderDetailItem(
          productId: item.product?.id,
          // Not rounded. Quantity is numeric(12,3) and a consignment line can
          // legitimately be fractional; `.round()` silently reported 1 for 1.5.
          qty: item.quantity,
          name: item.product?.name,
          code: item.product?.code.trim().isEmpty ?? true
              ? null
              : item.product!.code.trim(),
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          writtenOff: item.writtenOff,
          batchNumber: item.batchNumber?.isEmpty ?? true
              ? null
              : item.batchNumber,
        ),
      )
      .toList(growable: false),
  itemsTotal: order.itemsTotal,
  // Carried through rather than dropped. It is 1.00 on every imported order —
  // a placeholder, not a real shipping cost — but it is inside `total`, and
  // hiding it put a Subtotal and a Total on screen that differed by an amount
  // the screen never accounted for.
  freight: order.freight,
  total: order.total,
);

// ── Cart state ───────────────────────────────────────────────

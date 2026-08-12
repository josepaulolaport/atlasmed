import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/payment_method.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) {
  return OrdersRepository(baseUrl: AppConfig.apiBaseUrl);
});

final ordersPageProvider = FutureProvider.family<OrdersPage, List<String>?>((
  ref,
  statuses,
) {
  return ref.watch(ordersRepositoryProvider).listOrders(statuses: statuses);
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
String _formatCurrency(double value) =>
    'R\$ ${value.toStringAsFixed(2).replaceAll('.', ',')}';

final meusOrdersProvider =
    FutureProvider.family<List<OrderListItem>, List<String>?>((
      ref,
      statuses,
    ) async {
      final page = await ref.watch(ordersPageProvider(statuses).future);
      return page.data
          .map(
            (order) => OrderListItem(
              id: order.id,
              clinic: order.facility.name,
              doctor: order.professional?.name ?? 'Profissional não informado',
              date: _formatDate(order.orderedAt ?? order.createdAt),
              value: _formatCurrency(order.total),
              status: _orderStatusFromApi(order.status),
              items: order.itemCount,
            ),
          )
          .toList(growable: false);
    });

OrderDetail orderDetailForApi(ApiOrderDetail order) => OrderDetail(
  id: order.id,
  placedAt: _formatDate(order.orderedAt ?? order.createdAt),
  clinic: order.facility.name,
  clinicAddress: '',
  doctor: order.professional?.name ?? 'Profissional não informado',
  doctorCrm: '',
  status: _orderStatusFromApi(order.status),
  items: order.items
      .map(
        (item) => OrderDetailItem(
          productId: item.product?.id ?? item.id,
          qty: item.quantity.round(),
          name: item.product?.name,
          unitPrice: item.unitPrice,
        ),
      )
      .toList(growable: false),
  shipping: order.freight,
  paymentMethod: paymentMethodFromJson(order.notes ?? 'credit'),
  invoice: '',
  tracking: '',
  estimate: '',
  timeline: [
    TimelineStep(
      step: _orderStatusFromApi(order.status).label,
      date: _formatDate(order.updatedAt),
      done: true,
      current: true,
    ),
  ],
);

// ── Cart state ───────────────────────────────────────────────

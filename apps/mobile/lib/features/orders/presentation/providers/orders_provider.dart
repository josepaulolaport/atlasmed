import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/legacy_orders_mock.dart';
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

final orderDetailProvider = FutureProvider.family<ApiOrderDetail, String>((
  ref,
  orderId,
) {
  return ref.watch(ordersRepositoryProvider).getOrder(orderId);
});

OrderStatus _orderStatusFromApi(String status) {
  switch (status) {
    case 'SHIPPED':
      return OrderStatus.transito;
    case 'DELIVERED':
      return OrderStatus.entregue;
    case 'CANCELLED':
    case 'REJECTED':
      return OrderStatus.cancelado;
    case 'CONFIRMED':
      return OrderStatus.separacao;
    default:
      return OrderStatus.pendente;
  }
}

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
  id: order.displayId,
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
  paymentMethod: order.notes ?? 'Informação não disponível',
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
class CartState {
  final List<CartItem> items;
  final SelectableClinic? clinic;
  final SelectableDoctor? doctor;

  const CartState({this.items = const [], this.clinic, this.doctor});

  int get totalQty => items.fold(0, (s, i) => s + i.qty);

  double get subtotal {
    double total = 0;
    for (final item in items) {
      total += item.unitPrice * item.qty;
    }
    return total;
  }

  double get catalogSubtotal {
    double total = 0;
    for (final item in items) {
      total += (item.catalogUnitPrice ?? item.unitPrice) * item.qty;
    }
    return total;
  }

  double get savings => catalogSubtotal - subtotal;

  CartState copyWith({
    List<CartItem>? items,
    SelectableClinic? clinic,
    SelectableDoctor? doctor,
    bool clearClinic = false,
    bool clearDoctor = false,
  }) {
    return CartState(
      items: items ?? this.items,
      clinic: clearClinic ? null : (clinic ?? this.clinic),
      doctor: clearDoctor ? null : (doctor ?? this.doctor),
    );
  }
}

// ── Cart notifier ────────────────────────────────────────────
class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(const CartState());

  void addItem({
    required String productId,
    required String productName,
    required String productSubtitle,
    required int qty,
    required double unitPrice,
    required double catalogUnitPrice,
    required String? priceMode,
  }) {
    final existing = state.items.indexWhere((i) => i.productId == productId);
    if (existing >= 0) {
      final updated = [...state.items];
      updated[existing] = updated[existing].copyWith(
        qty: qty,
        unitPrice: unitPrice,
        catalogUnitPrice: catalogUnitPrice,
        priceMode: priceMode,
      );
      state = state.copyWith(items: updated);
    } else {
      state = state.copyWith(
        items: [
          ...state.items,
          CartItem(
            productId: productId,
            productName: productName,
            productSubtitle: productSubtitle,
            qty: qty,
            unitPrice: unitPrice,
            catalogUnitPrice: catalogUnitPrice,
            priceMode: priceMode,
          ),
        ],
      );
    }
  }

  void removeItem(String productId) {
    state = state.copyWith(
      items: state.items.where((i) => i.productId != productId).toList(),
    );
  }

  void updateQty(String productId, int qty) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    final updated = state.items
        .map((i) => i.productId == productId ? i.copyWith(qty: qty) : i)
        .toList();
    state = state.copyWith(items: updated);
  }

  void setClinic(SelectableClinic? clinic) {
    state = state.copyWith(clinic: clinic, clearDoctor: true);
  }

  void setDoctor(SelectableDoctor? doctor) {
    state = state.copyWith(doctor: doctor);
  }

  void clearCart() {
    state = const CartState();
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier();
});

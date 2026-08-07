import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/order.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/cart.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/selectable.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/payment_method.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/price_mode.dart';
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
class CartState {
  final List<CartItem> items;
  final SelectableClinic? clinic;
  final SelectableDoctor? doctor;
  final String? interactionId;
  final bool isClinicLocked;

  const CartState({
    this.items = const [],
    this.clinic,
    this.doctor,
    this.interactionId,
    this.isClinicLocked = false,
  });

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
    String? interactionId,
    bool? isClinicLocked,
    bool clearClinic = false,
    bool clearDoctor = false,
    bool clearInteraction = false,
  }) {
    return CartState(
      items: items ?? this.items,
      clinic: clearClinic ? null : (clinic ?? this.clinic),
      doctor: clearDoctor ? null : (doctor ?? this.doctor),
      interactionId: clearInteraction
          ? null
          : (interactionId ?? this.interactionId),
      isClinicLocked: clearInteraction
          ? false
          : (isClinicLocked ?? this.isClinicLocked),
    );
  }
}

// ── Cart notifier ────────────────────────────────────────────
class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(const CartState());

  void addItem({
    required int productId,
    required String productName,
    required String productSubtitle,
    required int qty,
    required double unitPrice,
    required double catalogUnitPrice,
    required PriceMode? priceMode,
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

  void removeItem(int productId) {
    state = state.copyWith(
      items: state.items.where((i) => i.productId != productId).toList(),
    );
  }

  void updateQty(int productId, int qty) {
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
    if (state.isClinicLocked) return;
    state = state.copyWith(clinic: clinic, clearDoctor: true);
  }

  void setInteractionContext({
    required String interactionId,
    required SelectableClinic clinic,
  }) {
    state = state.copyWith(
      interactionId: interactionId,
      clinic: clinic,
      isClinicLocked: true,
      clearDoctor: true,
    );
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

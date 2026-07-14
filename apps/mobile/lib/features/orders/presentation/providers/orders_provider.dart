import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models.dart';
import '../../data/mock_orders_repository.dart';

// ── Cart state ───────────────────────────────────────────────
class CartState {
  final List<CartItem> items;
  final SelectableClinic? clinic;
  final SelectableDoctor? doctor;

  const CartState({
    this.items = const [],
    this.clinic,
    this.doctor,
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
      final p = kProducts.firstWhere((p) => p.id == item.productId);
      total += p.unit * item.qty;
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

  void addItem(String productId, int qty, double unitPrice, String? priceMode) {
    final existing = state.items.indexWhere((i) => i.productId == productId);
    if (existing >= 0) {
      final updated = [...state.items];
      updated[existing] = updated[existing].copyWith(qty: qty, unitPrice: unitPrice, priceMode: priceMode);
      state = state.copyWith(items: updated);
    } else {
      state = state.copyWith(
        items: [...state.items, CartItem(productId: productId, qty: qty, unitPrice: unitPrice, priceMode: priceMode)],
      );
    }
  }

  void removeItem(String productId) {
    state = state.copyWith(items: state.items.where((i) => i.productId != productId).toList());
  }

  void updateQty(String productId, int qty) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    final updated = state.items.map((i) => i.productId == productId ? i.copyWith(qty: qty) : i).toList();
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

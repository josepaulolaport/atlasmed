import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/checkout_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('checkout reuses one idempotency key after a failed attempt', () async {
    var generated = 0;
    final controller = CheckoutSubmissionController(
      idempotencyKeyFactory: () => 'order-key-${++generated}',
    );

    final firstKey = controller.idempotencyKey;
    controller.recordFailure();
    final retryKey = controller.idempotencyKey;

    expect(firstKey, 'order-key-1');
    expect(retryKey, firstKey);
    expect(generated, 1);

    controller.recordSuccess();
    expect(controller.idempotencyKey, 'order-key-2');
  });

  test('confirmation snapshot is the immutable created order DTO', () {
    final order = ApiOrderDetail(
      id: 'order-real',
      idAvulsaEmultec: 42,
      verticalId: null,
      interactionId: 'interaction-1',
      status: 'PENDING',
      type: 'SALE',
      orderedAt: DateTime.utc(2026, 8, 3, 12),
      createdAt: DateTime.utc(2026, 8, 3, 12),
      updatedAt: DateTime.utc(2026, 8, 3, 12),
      facility: const ApiOrderIdentity(id: 'facility-1', name: 'Clínica Real'),
      professional: const ApiOrderIdentity(id: 'doctor-1', name: 'Dra. Real'),
      seller: null,
      itemCount: 1,
      itemsTotal: 80,
      freight: 5,
      total: 85,
      currency: 'BRL',
      notes: null,
      items: const [
        ApiOrderItem(
          id: 'item-1',
          quantity: 2,
          unitPrice: 40,
          lineTotal: 80,
          writtenOff: false,
          product: ApiOrderProduct(
            id: 'product-1',
            name: 'Produto Real',
            code: 'PR-1',
          ),
        ),
      ],
    );

    final controller = CheckoutSubmissionController();
    controller.recordCreatedOrder(order);

    expect(controller.confirmationOrder, same(order));
  });
}

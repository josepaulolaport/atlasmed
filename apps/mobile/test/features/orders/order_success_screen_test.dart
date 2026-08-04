import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_success_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

ApiOrderDetail _order() => ApiOrderDetail(
  id: 'order-real',
  legacyId: 42,
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

void main() {
  testWidgets(
    'success shows only truthful created order data after cart clear',
    (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(cartProvider.notifier).clearCart();

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light,
            home: OrderSuccessScreen(order: _order()),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('PED-42'), findsOneWidget);
      expect(find.text('Clínica Real'), findsOneWidget);
      expect(find.text('Dra. Real'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.textContaining('Produto Real'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('Produto Real'), findsOneWidget);
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pump();
      expect(find.textContaining('85,00'), findsOneWidget);
      expect(find.textContaining('Santa Mônica'), findsNothing);
      expect(find.textContaining('Mariana'), findsNothing);
      expect(find.textContaining('25 a 29 de abril'), findsNothing);
    },
  );
}

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_orders_section.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/my_orders_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('orders page keeps history without a new-order action', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          meusOrdersProvider.overrideWith((ref, statuses) async => const []),
        ],
        child: const MaterialApp(home: MyOrdersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Meus Pedidos'), findsOneWidget);
    expect(find.text('Novo pedido'), findsNothing);
    expect(find.textContaining('Novo pedido'), findsNothing);
  });

  testWidgets('empty clinic history has no create-order action', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ClinicOrdersSection(orders: [], facilityId: 'facility-1'),
        ),
      ),
    );

    expect(find.text('Nenhum pedido registrado'), findsOneWidget);
    expect(find.text('Criar pedido'), findsNothing);
  });

  testWidgets('order detail has no repeat-order action', (tester) async {
    final detail = ApiOrderDetail(
      id: 'order-1',
      idAvulsaEmultec: 1,
      verticalId: null,
      interactionId: null,
      status: 'DELIVERED',
      type: 'STANDARD',
      orderedAt: DateTime.utc(2026, 1, 2),
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 3),
      facility: const ApiOrderIdentity(id: 'facility-1', name: 'Clínica Um'),
      professional: null,
      seller: null,
      itemCount: 0,
      itemsTotal: 0,
      freight: 0,
      total: 0,
      currency: 'BRL',
      notes: null,
      items: const [],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          orderDetailProvider.overrideWith((ref, orderId) async => detail),
        ],
        child: const MaterialApp(home: OrderDetailScreen(orderId: 'order-1')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PED-1'), findsOneWidget);
    expect(find.text('Repetir pedido'), findsNothing);
  });
}

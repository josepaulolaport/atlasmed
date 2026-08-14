import 'package:atlasmed_mobile_app/features/orders/data/models/order_status.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// What the Pedidos screens are allowed to say.
///
/// The detail screen used to render a delivery ETA, a courier tracking code, a
/// payment method and an invoice number. None of those are stored anywhere —
/// the payment method was parsed out of the order's free-text `notes` with a
/// default of "credit", so every order claimed one. These tests pin that the
/// fabricated vocabulary is gone and that what replaced it comes from columns.

ApiOrderDetail detail({
  String status = 'INVOICED',
  String type = 'SALE',
  int? idAvulsaEmultec = 4321,
  String? notes,
  List<ApiOrderItem> items = const [],
  double itemsTotal = 0,
  double freight = 1,
  double total = 0,
}) => ApiOrderDetail(
  id: 7,
  idAvulsaEmultec: idAvulsaEmultec,
  verticalId: 1,
  status: status,
  type: type,
  orderedAt: DateTime.utc(2026, 3, 4),
  createdAt: DateTime.utc(2026, 3, 1),
  updatedAt: DateTime.utc(2026, 3, 5),
  facility: const ApiOrderIdentity(id: 1, name: 'Clínica Baeta Neves'),
  seller: const ApiOrderIdentity(id: 2, name: 'Adriana Oliveira'),
  itemCount: items.length,
  itemsTotal: itemsTotal,
  freight: freight,
  total: total,
  currency: 'BRL',
  notes: notes,
  items: items,
);

ApiOrderItem item({
  String name = 'Reviscon Mono',
  String code = 'RM20',
  double quantity = 2,
  double unitPrice = 500,
  double lineTotal = 1000,
  bool writtenOff = false,
  String? batchNumber,
}) => ApiOrderItem(
  id: 1,
  quantity: quantity,
  unitPrice: unitPrice,
  lineTotal: lineTotal,
  writtenOff: writtenOff,
  batchNumber: batchNumber,
  product: ApiOrderProduct(id: 9, name: name, code: code),
);

Future<void> pumpDetail(WidgetTester tester, ApiOrderDetail value) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        orderDetailProvider.overrideWith((ref, orderId) async => value),
      ],
      child: const MaterialApp(home: OrderDetailScreen(orderId: 7)),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('the detail screen shows only what exists', () {
    testWidgets('no payment method invented from the notes', (tester) async {
      // `paymentMethodFromJson(order.notes ?? 'credit')` — a free-text note
      // read as a payment method, defaulting to one nobody recorded.
      await pumpDetail(tester, detail(notes: 'Entregar na recepção'));

      expect(find.text('Pagamento'), findsNothing);
      expect(find.textContaining('Cartão'), findsNothing);
      expect(find.textContaining('Boleto'), findsNothing);
      // The note itself is real, and is shown as a note.
      expect(find.text('Observações'), findsOneWidget);
      expect(find.text('Entregar na recepção'), findsOneWidget);
    });

    testWidgets('no delivery, tracking or invoice claims', (tester) async {
      // There is no shipping, carrier or invoice table in the schema.
      await pumpDetail(tester, detail());

      for (final gone in [
        'Acompanhamento',
        'Rastreamento',
        'Nota fiscal',
        'Previsão de entrega',
        'Endereço',
      ]) {
        expect(find.text(gone), findsNothing, reason: '"$gone" has no column');
      }
    });

    testWidgets('no professional row', (tester) async {
      await pumpDetail(tester, detail());

      expect(find.textContaining('Profissional'), findsNothing);
      expect(find.text('CRM'), findsNothing);
    });

    testWidgets('hides freight, which is a 1.00 import placeholder', (
      tester,
    ) async {
      // Every imported order carries freight 1.00. A "Frete R$ 1,00" row reads
      // as a shipping cost; it is not one. It stays inside the total.
      await pumpDetail(
        tester,
        detail(items: [item()], itemsTotal: 1000, freight: 1, total: 1001),
      );

      expect(find.text('Frete'), findsNothing);
      expect(find.text('R\$ 1,00'), findsNothing);
      expect(find.text('R\$ 1001,00'), findsOneWidget);
    });

    testWidgets('names the order the way the clinic does', (tester) async {
      await pumpDetail(tester, detail());

      expect(find.text('PED-4321'), findsOneWidget);
    });

    testWidgets('falls back to the id when there is no Emultec number', (
      tester,
    ) async {
      await pumpDetail(tester, detail(idAvulsaEmultec: null));

      expect(find.text('7'), findsOneWidget);
    });

    testWidgets('shows the seller, the type and the line detail', (
      tester,
    ) async {
      await pumpDetail(
        tester,
        detail(
          items: [item(batchNumber: 'L-88', writtenOff: true)],
          itemsTotal: 1000,
          total: 1001,
        ),
      );

      expect(find.text('Adriana Oliveira'), findsOneWidget);
      expect(find.text('Venda'), findsOneWidget);
      expect(find.text('Reviscon Mono'), findsOneWidget);
      expect(find.textContaining('Cód. RM20'), findsOneWidget);
      expect(find.textContaining('Lote L-88'), findsOneWidget);
      // Supplied without being billed — it changes what the line means.
      expect(find.text('Baixado'), findsOneWidget);
    });

    testWidgets('does not round a fractional quantity down to a whole one', (
      tester,
    ) async {
      // quantity is numeric(12,3); the old model held it as an int, so 1.5
      // displayed as 2 — a made-up number on a line a rep reconciles.
      await pumpDetail(tester, detail(items: [item(quantity: 1.5)]));

      expect(find.textContaining('1.5 ×'), findsOneWidget);
    });

    testWidgets('prints a whole quantity without decimals', (tester) async {
      await pumpDetail(tester, detail(items: [item(quantity: 2)]));

      expect(find.textContaining('2 ×'), findsOneWidget);
    });
  });

  group('order status vocabulary', () {
    test('maps every status the enum actually has', () {
      // The chips used to send SHIPPED / DELIVERED / CANCELLED, which the API
      // rejects outright — three of the five tabs showed the error state.
      expect(orderStatusFromJson('INVOICED'), OrderStatus.invoiced);
      expect(orderStatusFromJson('NO_BILLING'), OrderStatus.noBilling);
      expect(orderStatusFromJson('APPROVED'), OrderStatus.approved);
      expect(orderStatusFromJson('REJECTED'), OrderStatus.rejected);
      expect(orderStatusFromJson('DRAFT'), OrderStatus.draft);
      expect(orderStatusFromJson('PENDING'), OrderStatus.pending);
    });
  });

  group('OrdersPage', () {
    test('reads the status breakdown and knows there is a next page', () {
      // The screen discarded pagination entirely, so on 1131 orders it showed
      // 20 with no way to reach the twenty-first.
      final page = OrdersPage.fromJson({
        'data': const [],
        'pagination': {'page': 1, 'limit': 20, 'total': 1131, 'totalPages': 57},
        'statusCounts': {'INVOICED': 714, 'NO_BILLING': 414, 'PENDING': 2},
      });

      expect(page.total, 1131);
      expect(page.hasNextPage, isTrue);
      expect(page.statusCounts['INVOICED'], 714);
      expect(page.statusCounts['NO_BILLING'], 414);
    });

    test('knows when it is on the last page', () {
      final page = OrdersPage.fromJson({
        'data': const [],
        'pagination': {
          'page': 57,
          'limit': 20,
          'total': 1131,
          'totalPages': 57,
        },
        'statusCounts': const <String, dynamic>{},
      });

      expect(page.hasNextPage, isFalse);
    });
  });
}

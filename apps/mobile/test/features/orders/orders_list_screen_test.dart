import 'dart:convert';

import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/my_orders_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Serves whatever the screen asks for, and remembers what it asked.
class FakeClient extends RepositoryHttpClient {
  FakeClient({this.orders = const [], this.statusCounts = const {}});

  final List<Map<String, dynamic>> orders;
  final Map<String, int> statusCounts;
  final List<Uri> requested = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requested.add(request.url);
    return RepositoryHttpResponse(
      statusCode: 200,
      headers: const {},
      body: jsonEncode({
        'data': orders,
        'pagination': {
          'page': 1,
          'limit': 20,
          'total': orders.length,
          'totalPages': orders.isEmpty ? 0 : 1,
        },
        'statusCounts': statusCounts,
      }),
    );
  }
}

Map<String, dynamic> order({int itemCount = 1}) => {
  'id': 1,
  'idAvulsaEmultec': 18820,
  'verticalId': 1,
  'status': 'INVOICED',
  'type': 'SALE',
  'orderedAt': '2026-08-04T00:00:00.000Z',
  'createdAt': '2026-08-04T00:00:00.000Z',
  'facility': {'id': 3, 'name': 'Poli Sante Medicina Integral'},
  'seller': {'id': 4, 'name': 'Flavio Ramalho'},
  'itemCount': itemCount,
  'itemsTotal': 2500,
  'freight': 1,
  'total': 2501,
};

Future<FakeClient> pumpList(
  WidgetTester tester, {
  List<Map<String, dynamic>> orders = const [],
  Map<String, int> statusCounts = const {},
}) async {
  final client = FakeClient(orders: orders, statusCounts: statusCounts);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ordersRepositoryProvider.overrideWithValue(
          OrdersRepository(baseUrl: 'https://api.test', client: client),
        ),
      ],
      child: const MaterialApp(home: MyOrdersScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return client;
}

void main() {
  // A phone, not the 800x600 default: the summary strip and the chip row are
  // laid out across the width.
  setUp(() {
    // ignore: deprecated_member_use
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  testWidgets('one item is an item, not "1 itens"', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await pumpList(tester, orders: [order(itemCount: 1)]);

    expect(find.textContaining('1 item'), findsOneWidget);
    expect(find.textContaining('1 itens'), findsNothing);
  });

  testWidgets('several items keep the plural', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await pumpList(tester, orders: [order(itemCount: 3)]);

    expect(find.textContaining('3 itens'), findsOneWidget);
  });

  testWidgets('the summary numbers filter the list', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    // Three big number cards sat above the chips doing nothing, on the screen
    // a rep opens most often.
    final client = await pumpList(
      tester,
      orders: [order()],
      statusCounts: const {'INVOICED': 714, 'NO_BILLING': 414, 'PENDING': 2},
    );

    await tester.tap(find.byKey(const Key('orders-summary-Faturados')));
    await tester.pumpAndSettle();

    expect(client.requested.last.queryParameters['status'], 'INVOICED');
  });

  testWidgets('tapping the applied summary card clears back to everything', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final client = await pumpList(
      tester,
      orders: [order()],
      statusCounts: const {'INVOICED': 714},
    );

    await tester.tap(find.byKey(const Key('orders-summary-Faturados')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('orders-summary-Faturados')));
    await tester.pumpAndSettle();

    expect(
      client.requested.last.queryParameters.containsKey('status'),
      isFalse,
      reason: 'the strip has to be a way back, not a one-way trip',
    );
  });

  testWidgets('an empty list under a status filter does not claim there are '
      'no orders at all', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await pumpList(tester);

    // Nothing filtered: this really is "no orders yet".
    expect(find.text('Nenhum pedido ainda'), findsOneWidget);

    await tester.tap(find.byKey(const Key('orders-summary-Sem faturamento')));
    await tester.pumpAndSettle();

    expect(find.text('Nenhum pedido ainda'), findsNothing);
    expect(find.text('Nenhum pedido encontrado'), findsOneWidget);
    expect(find.textContaining('"sem faturamento"'), findsOneWidget);
  });
}

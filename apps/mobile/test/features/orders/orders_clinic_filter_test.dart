import 'dart:convert';

import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records what the repository asked the API for.
class _RecordingClient extends RepositoryHttpClient {
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
        'data': const [],
        'pagination': {'page': 1, 'limit': 20, 'total': 0, 'totalPages': 0},
        'statusCounts': const {},
      }),
    );
  }
}

void main() {
  group('listOrders', () {
    test('asks for one clinic when the list is narrowed to it', () async {
      final client = _RecordingClient();
      final repository = OrdersRepository(
        baseUrl: 'https://api.example.com',
        client: client,
      );

      await repository.listOrders(facilityId: 149);

      // The route has always taken `facilityId`; nothing sent it, so "every
      // order for this clinic" could not be asked.
      expect(client.requested.single.queryParameters['facilityId'], '149');
    });

    test('omits the clinic entirely when showing everything', () async {
      final client = _RecordingClient();
      final repository = OrdersRepository(
        baseUrl: 'https://api.example.com',
        client: client,
      );

      await repository.listOrders();

      expect(
        client.requested.single.queryParameters.containsKey('facilityId'),
        isFalse,
        reason: 'an absent filter must not become facilityId=null on the wire',
      );
    });

    test('a clinic and a status narrow together', () async {
      final client = _RecordingClient();
      final repository = OrdersRepository(
        baseUrl: 'https://api.example.com',
        client: client,
      );

      await repository.listOrders(facilityId: 149, statuses: ['REJECTED']);

      final query = client.requested.single.queryParameters;
      expect(query['facilityId'], '149');
      expect(query['status'], 'REJECTED');
    });
  });
}

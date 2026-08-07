import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class RecordingClient extends RepositoryHttpClient {
  RecordingClient(this.response) : super();

  final RepositoryHttpResponse response;
  RepositoryHttpRequest? request;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    this.request = request;
    return response;
  }
}

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();
  test('builds paginated orders URL with comma-separated status filter', () async {
    final client = RecordingClient(
      const RepositoryHttpResponse(
        statusCode: 200,
        headers: {},
        body:
            '{"data":[],"pagination":{"page":2,"limit":10,"total":0,"totalPages":1}}',
      ),
    );
    final repository = OrdersRepository(
      baseUrl: 'https://api.atlasmed.test',
      client: client,
    );

    await repository.listOrders(
      page: 2,
      limit: 10,
      statuses: ['PENDING', 'SHIPPED'],
    );

    expect(
      client.request!.url.toString(),
      'https://api.atlasmed.test/api/v1/orders?page=2&limit=10&status=PENDING%2CSHIPPED',
    );
  });

  test('parses order list and expanded order detail responses', () async {
    final listClient = RecordingClient(
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'data': [
            {
              'id': 1,
              'legacyId': 14,
              'status': 'SHIPPED',
              'type': 'STANDARD',
              'orderedAt': '2026-01-02T10:00:00.000Z',
              'createdAt': '2026-01-01T10:00:00.000Z',
              'facility': {'id': 10, 'name': 'Clínica Um'},
              'professional': null,
              'seller': null,
              'itemCount': 2,
              'itemsTotal': 100,
              'freight': 5,
              'total': 105,
            },
          ],
          'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
        }),
      ),
    );
    final list = await OrdersRepository(
      baseUrl: 'https://api.atlasmed.test',
      client: listClient,
    ).listOrders();
    expect(list.data.single.displayId, 'PED-14');
    expect(list.data.single.total, 105);

    final detailClient = RecordingClient(
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'id': 1,
          'legacyId': null,
          'status': 'DELIVERED',
          'type': 'STANDARD',
          'orderedAt': null,
          'createdAt': '2026-01-01T10:00:00.000Z',
          'updatedAt': '2026-01-02T10:00:00.000Z',
          'facility': {'id': 10, 'name': 'Clínica Um'},
          'professional': null,
          'seller': null,
          'freight': 5,
          'currency': 'BRL',
          'itemsTotal': 100,
          'total': 105,
          'items': [
            {
              'id': 100,
              'quantity': 2,
              'unitPrice': 50,
              'lineTotal': 100,
              'writtenOff': false,
              'product': {
                'id': 20,
                'name': 'Produto Um',
                'code': 'P-1',
              },
            },
          ],
        }),
      ),
    );
    final detail = await OrdersRepository(
      baseUrl: 'https://api.atlasmed.test',
      client: detailClient,
    ).getOrder(1);
    expect(detail.items.single.product!.name, 'Produto Um');
    expect(detail.total, 105);
  });
}

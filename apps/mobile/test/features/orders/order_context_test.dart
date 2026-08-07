import 'dart:convert';

import 'package:atlasmed_mobile_app/features/orders/data/models/selectable.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/providers/orders_provider.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

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

class _RecordingClient extends RepositoryHttpClient {
  _RecordingClient(this.response);
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

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('cart carries interaction context and locks its clinic', () {
    final notifier = CartNotifier();
    notifier.setInteractionContext(
      interactionId: 'interaction-1',
      clinic: const SelectableClinic(id: 'facility-1', name: 'Clínica Central'),
    );

    notifier.setClinic(
      const SelectableClinic(id: 'facility-2', name: 'Outra clínica'),
    );

    expect(notifier.state.interactionId, 'interaction-1');
    expect(notifier.state.clinic?.id, 'facility-1');
    expect(notifier.state.isClinicLocked, isTrue);

    notifier.clearCart();
    expect(notifier.state.interactionId, isNull);
    expect(notifier.state.clinic, isNull);
  });

  test('create request serializes interactionId', () async {
    final client = _RecordingClient(
      RepositoryHttpResponse(
        statusCode: 201,
        headers: const {},
        body: jsonEncode({
          'id': 'order-1',
          'idAvulsaEmultec': null,
          'interactionId': 'interaction-1',
          'verticalId': null,
          'status': 'PENDING',
          'type': 'SALE',
          'orderedAt': null,
          'createdAt': '2026-08-03T12:00:00.000Z',
          'updatedAt': '2026-08-03T12:00:00.000Z',
          'facility': {'id': 'facility-1', 'name': 'Clínica Central'},
          'professional': null,
          'seller': null,
          'itemCount': 1,
          'itemsTotal': 10,
          'freight': 0,
          'total': 10,
          'currency': 'BRL',
          'notes': null,
          'items': const <Object>[],
        }),
      ),
    );
    final repository = OrdersRepository(
      baseUrl: 'https://api.atlasmed.test',
      client: client,
    );

    await repository.createOrder(
      facilityId: 'facility-1',
      interactionId: 'interaction-1',
      idempotencyKey: 'order-attempt-1',
      items: const [CreateOrderItemInput(productId: 'product-1', quantity: 1)],
    );

    expect(client.request!.body?['interactionId'], 'interaction-1');
    expect(client.request!.headers['Idempotency-Key'], 'order-attempt-1');
  });
}

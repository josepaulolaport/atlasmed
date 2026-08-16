import 'dart:convert';

import 'package:atlasmed_mobile_app/features/roteiro/data/repositories/roteiro_repository.dart';
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
  _RecordingClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

RepositoryHttpResponse _response(Object body) => RepositoryHttpResponse(
  statusCode: 200,
  headers: const {},
  body: jsonEncode(body),
);

/// What `POST /roteiros` answers: the planned day, with everything the rep
/// reads on the card.
Map<String, dynamic> _plannedDay() => {
  'id': 7,
  'scopeDate': '2026-08-16',
  'stops': [
    {
      'position': 1,
      'facilityVerticalProfileId': 86,
      'bucket': 'PROSPECTAR',
      'modality': 'IN_PERSON',
      'serviceMinutes': 60,
      'plannedStartsAt': '2026-08-16T15:00:00.000Z',
      'plannedEndsAt': '2026-08-16T16:00:00.000Z',
      'travelSecondsFromPrev': 1140,
      'candidate': {
        'facilityId': 45,
        'facilityVerticalProfileId': 86,
        'facilityName': 'Intermedica Marechal Floriano',
        'municipality': 'Rio de Janeiro',
        'bucket': 'PROSPECTAR',
        'straightLineKm': 19.0,
        'components': {
          'c': {'raw': 0.4, 'weighted': 0.108, 'orthopaedists': 0},
        },
      },
    },
  ],
};

/// What `POST /roteiros/:id/confirm` answers: the stored row. No facility
/// names, no cities, no distances, no travel.
Map<String, dynamic> _storedRow() => {
  'id': 7,
  'scopeDate': '2026-08-16',
  'status': 'CONFIRMED',
  'stops': [
    {
      'position': 1,
      'facilityVerticalProfileId': 86,
      'bucket': 'PROSPECTAR',
      'modality': 'IN_PERSON',
      'serviceMinutes': 60,
      'plannedStartsAt': '2026-08-16T15:00:00.000Z',
      'plannedEndsAt': '2026-08-16T16:00:00.000Z',
      'calendarId': 21,
      'interactionId': 33,
    },
  ],
};

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('saving keeps the planned day, not the stored row', () async {
    // Save is two calls: persist, then confirm. Returning the confirm response
    // replaced the slate the rep had just approved with cards that had no
    // clinic name, no distance and no travel — the save read as though it had
    // emptied the day it was in fact writing.
    final client = _RecordingClient([
      _response(_plannedDay()),
      _response(_storedRow()),
    ]);
    final repository = RoteiroRepository(
      baseUrl: 'http://localhost',
      client: client,
    );

    final saved = await repository.save(verticalId: 1, scopeDate: '2026-08-16');

    expect(saved.stops.single.facilityName, 'Intermedica Marechal Floriano');
    expect(saved.stops.single.municipality, 'Rio de Janeiro');
    expect(saved.stops.single.straightLineKm, 19.0);
    expect(saved.stops.single.travelSecondsFromPrev, 1140);
  });

  test('saving still confirms, and against the id it just persisted', () async {
    // Keeping the planned day must not turn confirm into a no-op: it is the
    // call that writes the visits into the calendar.
    final client = _RecordingClient([
      _response(_plannedDay()),
      _response(_storedRow()),
    ]);
    final repository = RoteiroRepository(
      baseUrl: 'http://localhost',
      client: client,
    );

    await repository.save(verticalId: 1, scopeDate: '2026-08-16');

    expect(client.requests, hasLength(2));
    expect(client.requests.first.url.path, '/api/v1/roteiros');
    expect(client.requests.last.url.path, '/api/v1/roteiros/7/confirm');
  });
}

import 'dart:convert';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
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
  void Function()? onFirstCall;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    if (requests.length == 1) onFirstCall?.call();
    if (responses.isEmpty) {
      throw const CalendarNetworkException('Sem resposta configurada.');
    }
    return responses.removeAt(0);
  }
}

RepositoryHttpResponse _response(int statusCode, Object body) =>
    RepositoryHttpResponse(
      statusCode: statusCode,
      headers: const {},
      body: body is String ? body : jsonEncode(body),
    );

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test(
    'builds range list URL using UTC ISO instants and optional owner',
    () async {
      final client = _RecordingClient([
        _response(200, {'data': <Object>[]}),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      await repository.listCalendar(
        from: DateTime.parse('2026-08-03T00:00:00-03:00'),
        to: DateTime.parse('2026-08-10T00:00:00-03:00'),
        ownerUserId: 2,
      );

      expect(client.requests.single.method, RepositoryHttpMethod.get);
      expect(
        client.requests.single.url.toString(),
        'https://api.atlasmed.test/api/v1/calendar?from=2026-08-03T03%3A00%3A00.000Z&to=2026-08-10T03%3A00%3A00.000Z&ownerUserId=2',
      );
    },
  );

  test(
    'builds availability URL and parses the direct array response',
    () async {
      final client = _RecordingClient([
        _response(200, [
          {
            'startsAt': '2026-08-03T12:00:00.000Z',
            'endsAt': '2026-08-03T13:00:00.000Z',
          },
        ]),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      final intervals = await repository.getAvailability(
        from: DateTime.utc(2026, 8, 3),
        to: DateTime.utc(2026, 8, 4),
      );

      expect(client.requests.single.url.path, '/api/v1/calendar/availability');
      expect(intervals.single.occurrenceId, isNull);
      expect(intervals.single.startsAt, DateTime.utc(2026, 8, 3, 12));
    },
  );

  test('maps the global validation envelope from status 400', () async {
    final error = await _capturedError(
      _response(400, {
        'error': {
          'code': 'VALIDATION_ERROR',
          'message': 'Request validation failed',
          'errors': [
            {'field': 'from', 'message': 'Invalid date'},
          ],
        },
      }),
    );

    expect(error, isA<CalendarValidationException>());
    expect((error as CalendarValidationException).details, isNotEmpty);
  });

  test('maps calendar conflict candidate and existing intervals', () async {
    final error = await _capturedError(
      _response(409, {
        'error': {
          'code': 'CALENDAR_CONFLICT',
          'message': 'Horário indisponível.',
          'conflicts': [
            {
              'candidateId': 10,
              'existingId': 1,
              'candidateStartsAt': '2026-08-03T12:00:00.000Z',
              'candidateEndsAt': '2026-08-03T13:00:00.000Z',
              'existingStartsAt': '2026-08-03T12:30:00.000Z',
              'existingEndsAt': '2026-08-03T13:30:00.000Z',
            },
          ],
        },
      }),
    );

    expect(error, isA<CalendarConflictException>());
    final conflict = (error as CalendarConflictException).conflicts.single;
    expect(conflict.candidate.startsAt, DateTime.utc(2026, 8, 3, 12));
    expect(conflict.existing.endsAt, DateTime.utc(2026, 8, 3, 13, 30));
  });

  test('maps calendar version conflicts to a distinct exception', () async {
    final error = await _capturedError(
      _response(409, {
        'error': {
          'code': 'CALENDAR_VERSION_CONFLICT',
          'message': 'Versão desatualizada.',
          'calendarId': 1,
          'expectedVersion': 4,
        },
      }),
    );

    expect(error, isA<CalendarVersionConflictException>());
    final versionError = error as CalendarVersionConflictException;
    expect(versionError.calendarId, 1);
    expect(versionError.expectedVersion, 4);
  });

  test(
    'maps forbidden and network failures without losing their type',
    () async {
      expect(
        await _capturedError(
          _response(403, {
            'error': {'code': 'FORBIDDEN', 'message': 'Sem acesso.'},
          }),
        ),
        isA<CalendarForbiddenException>(),
      );

      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: _ThrowingClient(),
      );
      expect(
        () => repository.listCalendar(
          from: DateTime.utc(2026, 8, 3),
          to: DateTime.utc(2026, 8, 4),
        ),
        throwsA(isA<CalendarNetworkException>()),
      );
    },
  );
  test(
    'creates calendar with idempotency header and exact API contract',
    () async {
      final client = _RecordingClient([
        _response(200, {'id': 1}),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      await repository.createCalendar(
        idempotencyKey: 'create-123',
        command: const CalendarCreateCommand(
          kind: CalendarEventKind.interaction,
          title: 'Visita',
          facilityId: 1,
          modality: CalendarModality.inPerson,
          startsAt: '2026-08-03T09:00:00-03:00',
          timeZone: 'America/Sao_Paulo',
          durationMinutes: 60,
          recurrence: CalendarRecurrence.weekly,
          recurrenceCount: 4,
        ),
      );

      final request = client.requests.single;
      expect(request.method, RepositoryHttpMethod.post);
      expect(request.url.path, '/api/v1/calendar');
      expect(request.headers['Idempotency-Key'], 'create-123');
      expect(request.body, {
        'kind': 'INTERACTION',
        'title': 'Visita',
        'facilityId': 1,
        'modality': 'IN_PERSON',
        'startsAt': '2026-08-03T09:00:00-03:00',
        'timeZone': 'America/Sao_Paulo',
        'durationMinutes': 60,
        'recurrence': 'WEEKLY',
        'recurrenceCount': 4,
      });
    },
  );

  test(
    'updates series, occurrence and cancellation with expected versions',
    () async {
      final client = _RecordingClient([
        _response(200, {'id': 1}),
        _response(200, {'id': 2}),
        _response(200, {'id': 1, 'cancelled': true}),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      await repository.updateCalendar(
        calendarId: 1,
        idempotencyKey: 'update-series',
        command: const CalendarUpdateCommand(
          expectedVersion: 3,
          title: 'Novo título',
        ),
      );
      await repository.updateCalendarOccurrence(
        calendarId: 1,
        recurrenceKey: '2026-08-03T09:00',
        idempotencyKey: 'update-occurrence',
        command: const CalendarOccurrenceUpdateCommand(
          expectedVersion: 0,
          startsAt: '2026-08-03T10:00:00-03:00',
          durationMinutes: 60,
        ),
      );
      await repository.cancelCalendar(
        calendarId: 1,
        idempotencyKey: 'cancel-series',
        command: const CalendarCancellationCommand(
          expectedVersion: 3,
          reason: 'Mudança de agenda',
        ),
      );

      expect(client.requests[0].method, RepositoryHttpMethod.patch);
      expect(client.requests[0].body?['expectedVersion'], 3);
      expect(
        client.requests[1].url.path,
        '/api/v1/calendar/1/occurrences/2026-08-03T09%3A00',
      );
      expect(client.requests[1].body?['expectedVersion'], 0);
      expect(client.requests[2].method, RepositoryHttpMethod.delete);
      expect(client.requests[2].body?['reason'], 'Mudança de agenda');
    },
  );

  test('gets interaction detail without issuing a lifecycle command', () async {
    final client = _RecordingClient([_response(200, _interactionJson())]);
    final repository = CalendarRepository(
      baseUrl: 'https://api.atlasmed.test',
      client: client,
    );

    final interaction = await repository.getInteraction(1);

    expect(client.requests, hasLength(1));
    expect(client.requests.single.method, RepositoryHttpMethod.get);
    expect(client.requests.single.url.path, '/api/v1/interactions/1');
    expect(interaction.status, InteractionStatus.scheduled);
    expect(interaction.facility.displayName, 'Clínica Central');
    expect(interaction.linkedOrders.single.id, 1);
  });

  test(
    'starts early with stable idempotency key and expected version',
    () async {
      final client = _RecordingClient([
        _response(200, _interactionJson(status: 'IN_PROGRESS', version: 4)),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      final interaction = await repository.startInteraction(
        1,
        expectedVersion: 3,
        idempotencyKey: 'start-interaction-1-3',
      );

      final request = client.requests.single;
      expect(request.method, RepositoryHttpMethod.post);
      expect(request.url.path, '/api/v1/interactions/1/start');
      expect(request.headers['Idempotency-Key'], 'start-interaction-1-3');
      // Without it Elysia parses no body and answers 400 for fields that were
      // sent. The calendar mutations always set it; these did not, so the whole
      // capture loop could not work from the app.
      expect(request.headers['Content-Type'], 'application/json');
      expect((request.body as Map)['expectedVersion'], 3);
      // §15.6.6-4: the device says when the rep pressed. Without it the server
      // stamps receipt time, and a start queued in a clinic with no signal
      // records the moment the queue drained.
      expect(
        DateTime.parse((request.body as Map)['startedAt'] as String).isUtc,
        isTrue,
      );
      expect(interaction.status, InteractionStatus.inProgress);
      expect(interaction.version, 4);
    },
  );

  test(
    'completes a missed interaction with correction justification',
    () async {
      final client = _RecordingClient([
        _response(200, _interactionJson(status: 'COMPLETED', version: 5)),
      ]);
      final repository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: client,
      );

      await repository.completeInteraction(
        1,
        expectedVersion: 4,
        idempotencyKey: 'complete-interaction-1-4',
        correctionReason: 'Atendimento confirmado posteriormente.',
      );

      final body = client.requests.single.body as Map;
      expect(body['expectedVersion'], 4);
      expect(
        body['correctionReason'],
        'Atendimento confirmado posteriormente.',
      );
      // The end is the device's too: waiting for signal would otherwise
      // inflate the duration by however long the wait was.
      expect(DateTime.parse(body['completedAt'] as String).isUtc, isTrue);
    },
  );

  test(
    'maps interaction transition and version conflicts for retry UI',
    () async {
      final transitionRepository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: _RecordingClient([
          _response(409, {
            'error': {
              'code': 'INTERACTION_INVALID_TRANSITION',
              'message': 'Transição inválida.',
            },
          }),
        ]),
      );
      expect(
        () => transitionRepository.startInteraction(
          1,
          expectedVersion: 1,
          idempotencyKey: 'stable-key',
        ),
        throwsA(isA<InteractionTransitionException>()),
      );

      final versionRepository = CalendarRepository(
        baseUrl: 'https://api.atlasmed.test',
        client: _RecordingClient([
          _response(409, {
            'error': {
              'code': 'INTERACTION_VERSION_CONFLICT',
              'message': 'Versão desatualizada.',
              'expectedVersion': 2,
              'actualVersion': 3,
            },
          }),
        ]),
      );
      expect(
        () => versionRepository.completeInteraction(
          1,
          expectedVersion: 2,
          idempotencyKey: 'stable-key',
        ),
        throwsA(isA<InteractionVersionConflictException>()),
      );
    },
  );
}

Map<String, dynamic> _interactionJson({
  String status = 'SCHEDULED',
  int version = 3,
}) => {
  'id': 1,
  'calendarId': 1,
  'recurrenceKey': '2026-08-03T09:00',
  'modality': 'IN_PERSON',
  'status': status,
  'actualStartedAt': null,
  'actualEndedAt': null,
  'correctedAt': null,
  'correctedByUserId': null,
  'correctionReason': null,
  'visitId': null,
  'version': version,
  'calendar': {'id': 1, 'title': 'Visita comercial'},
  'occurrence': {
    'recurrenceKey': '2026-08-03T09:00',
    'startsAt': '2026-08-03T12:00:00.000Z',
    'endsAt': '2026-08-03T13:00:00.000Z',
    'timeZone': 'America/Sao_Paulo',
  },
  'facility': {
    'id': 1,
    'displayName': 'Clínica Central',
    'city': 'São Paulo',
    'state': 'SP',
  },
  'agent': {
    'id': 1,
    'firstName': 'Ana',
    'lastName': 'Souza',
    'displayName': 'Ana Souza',
  },
  'linkedOrders': [
    {
      'id': 1,
      'status': 'PENDING',
      'type': 'SALE',
      'orderedAt': '2026-08-03T12:30:00.000Z',
    },
  ],
  'canMutate': true,
};

Future<Object> _capturedError(RepositoryHttpResponse response) async {
  final repository = CalendarRepository(
    baseUrl: 'https://api.atlasmed.test',
    client: _RecordingClient([response]),
  );
  try {
    await repository.listCalendar(
      from: DateTime.utc(2026, 8, 3),
      to: DateTime.utc(2026, 8, 4),
    );
    return StateError('Era esperado um erro.');
  } catch (error) {
    return error;
  }
}

class _ThrowingClient extends RepositoryHttpClient {
  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) {
    throw Exception('offline');
  }
}

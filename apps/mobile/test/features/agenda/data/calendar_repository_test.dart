import 'dart:convert';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingClient extends RepositoryHttpClient {
  _RecordingClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
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
        ownerUserId: 'user-2',
      );

      expect(client.requests.single.method, RepositoryHttpMethod.get);
      expect(
        client.requests.single.url.toString(),
        'https://api.atlasmed.test/api/v1/calendar?from=2026-08-03T03%3A00%3A00.000Z&to=2026-08-10T03%3A00%3A00.000Z&ownerUserId=user-2',
      );
    },
  );

  test('builds availability URL and parses busy intervals', () async {
    final client = _RecordingClient([
      _response(200, {
        'data': [
          {
            'startsAt': '2026-08-03T12:00:00.000Z',
            'endsAt': '2026-08-03T13:00:00.000Z',
            'occurrenceId': 'calendar-1:key',
          },
        ],
      }),
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
    expect(intervals.single.occurrenceId, 'calendar-1:key');
    expect(intervals.single.startsAt, DateTime.utc(2026, 8, 3, 12));
  });

  test(
    'maps forbidden, conflict, validation/version, and network errors',
    () async {
      Future<Object> captured(Object body, int status) async {
        final repository = CalendarRepository(
          baseUrl: 'https://api.atlasmed.test',
          client: _RecordingClient([_response(status, body)]),
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

      expect(
        await captured({
          'error': {'message': 'Sem acesso.'},
        }, 403),
        isA<CalendarForbiddenException>(),
      );
      final conflict = await captured({
        'error': {
          'message': 'Horário indisponível.',
          'conflicts': [
            {
              'startsAt': '2026-08-03T12:00:00.000Z',
              'endsAt': '2026-08-03T13:00:00.000Z',
              'occurrenceId': 'calendar-1:key',
            },
          ],
        },
      }, 409);
      expect(conflict, isA<CalendarConflictException>());
      expect(
        (conflict as CalendarConflictException).conflicts.single.occurrenceId,
        'calendar-1:key',
      );
      expect(
        await captured({
          'error': {'message': 'Versão desatualizada.'},
        }, 422),
        isA<CalendarValidationException>(),
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
}

class _ThrowingClient extends RepositoryHttpClient {
  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) {
    throw Exception('offline');
  }
}

import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'calendar_models.dart';

/// When the device says something happened, as an offset ISO-8601 instant.
///
/// Spec 0016 §15.6.6-4: the server used to stamp receipt time, so anything sent
/// from a clinic with no signal recorded the moment the queue drained rather
/// than the moment it happened. The server accepts this within bounds — not in
/// the future, not more than a day old — and falls back to its own clock when
/// it is absent.
String clientInstant([DateTime? at]) =>
    (at ?? DateTime.now()).toUtc().toIso8601String();

abstract interface class CalendarRepositoryContract {
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  });

  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  });

  Future<InteractionDetail> getInteraction(int id);

  /// [startedAt] is the instant the rep pressed, offset ISO-8601. Omitted
  /// means now; the queue passes the original stamp when replaying, which is
  /// the whole point of §15.6.6-4.
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? startedAt,
  });

  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
    String? completedAt,
  });

  /// Records how the visit went and when to return — spec 0016 §15.6.4.
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  });

  /// Records arriving at a clinic the roteiro never suggested — §15.6.3.
  ///
  /// Creates the visit and starts it in one call. There is no appointment to
  /// start, which is the point: a rep who simply walks into a clinic had no
  /// way to record it, and a system that can only record its own suggestions
  /// under-counts real work.
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  });
}

abstract interface class CalendarMutationRepositoryContract {
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  });

  Future<void> updateCalendar({
    required int calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  });

  Future<void> updateCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  });

  Future<void> cancelCalendar({
    required int calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  });

  Future<void> cancelCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  });
}

class CalendarRepository extends Repository<List<CalendarOccurrence>>
    with SessionEnvironmentMixin<List<CalendarOccurrence>>
    implements CalendarRepositoryContract, CalendarMutationRepositoryContract {
  CalendarRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUri = Uri.parse(baseUrl ?? AppConfig.apiBaseUrl),
      _client = client,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/calendar',
        ),
        resolveOnCreate: false,
        name: 'CalendarRepository',
      );

  final Uri _baseUri;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client =>
      _client ??
      createPlatformHttpClient(
        tokenBuilder: SessionEnvironment.instance.tokenBuilder,
      );

  @override
  List<CalendarOccurrence> fromJson(String json) => const [];

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async {
    final response = await _call(
      _calendarUri('', from: from, to: to, ownerUserId: ownerUserId),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwIfError(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is List<dynamic>
        ? decoded
        : (decoded as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
    return data
        .cast<Map<String, dynamic>>()
        .map(CalendarOccurrence.fromJson)
        .toList(growable: false);
  }

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async {
    final response = await _call(
      _calendarUri(
        '/availability',
        from: from,
        to: to,
        ownerUserId: ownerUserId,
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwIfError(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is List<dynamic>
        ? decoded
        : ((decoded as Map<String, dynamic>)['data'] ??
                      decoded['busy'] ??
                      decoded['intervals'])
                  as List<dynamic>? ??
              const [];
    return data
        .cast<Map<String, dynamic>>()
        .map(CalendarAvailabilityInterval.fromJson)
        .toList(growable: false);
  }

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) => _mutate(
    path: '/api/v1/calendar',
    method: RepositoryHttpMethod.post,
    body: command.toJson(),
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<void> updateCalendar({
    required int calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) => _mutate(
    path: '/api/v1/calendar/$calendarId',
    method: RepositoryHttpMethod.patch,
    body: command.toJson(),
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<void> updateCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) => _mutate(
    path:
        '/api/v1/calendar/$calendarId/occurrences/${Uri.encodeComponent(recurrenceKey)}',
    method: RepositoryHttpMethod.patch,
    body: command.toJson(),
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<void> cancelCalendar({
    required int calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) => _mutate(
    path: '/api/v1/calendar/$calendarId',
    method: RepositoryHttpMethod.delete,
    body: command.toJson(),
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<void> cancelCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) => _mutate(
    path:
        '/api/v1/calendar/$calendarId/occurrences/${Uri.encodeComponent(recurrenceKey)}',
    method: RepositoryHttpMethod.delete,
    body: command.toJson(),
    idempotencyKey: idempotencyKey,
  );

  Future<void> _mutate({
    required String path,
    required RepositoryHttpMethod method,
    required Map<String, dynamic> body,
    required String idempotencyKey,
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: path, query: null),
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: body,
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwIfError(response);
    }
  }

  @override
  Future<InteractionDetail> getInteraction(int id) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id'),
      ),
    );
    return _interactionFromResponse(response);
  }

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? startedAt,
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id/start'),
        method: RepositoryHttpMethod.post,
        // Content-Type is load-bearing: without it Elysia parses no body at
        // all and answers 400 "Expected number" for a field that was sent.
        // The calendar mutations always set it; these four never did, so the
        // whole capture loop — start, complete, outcome, arrival — could not
        // work from the app. Invisible because no test crosses the real HTTP
        // layer, and nobody had pressed the buttons yet.
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        // §15.6.6-4: the moment the rep pressed, not the moment the request
        // arrived. A start queued in a clinic with no signal used to be
        // stamped when connectivity returned, and every duration computed
        // from it was fiction.
        body: {
          'expectedVersion': expectedVersion,
          'startedAt': startedAt ?? clientInstant(),
        },
      ),
    );
    return _interactionFromResponse(response);
  }

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
    String? completedAt,
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id/complete'),
        method: RepositoryHttpMethod.post,
        // Content-Type is load-bearing: without it Elysia parses no body at
        // all and answers 400 "Expected number" for a field that was sent.
        // The calendar mutations always set it; these four never did, so the
        // whole capture loop — start, complete, outcome, arrival — could not
        // work from the app. Invisible because no test crosses the real HTTP
        // layer, and nobody had pressed the buttons yet.
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: {
          'expectedVersion': expectedVersion,
          // The end is the device's too: waiting for signal would otherwise
          // inflate the duration by however long the wait was.
          'completedAt': completedAt ?? clientInstant(),
          if (correctionReason != null && correctionReason.trim().isNotEmpty)
            'correctionReason': correctionReason.trim(),
        },
      ),
    );
    return _interactionFromResponse(response);
  }

  /// Records how the visit went and when to return — spec 0016 §15.6.4.
  ///
  /// No `expectedVersion`: answering is not a state transition, and a visit
  /// closed for the rep by an arrival or by the workday-end job will already
  /// have moved past whatever version their screen was holding.
  @override
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id/outcome'),
        method: RepositoryHttpMethod.post,
        headers: {'Content-Type': 'application/json'},
        body: {'outcome': outcome.wire, 'followUp': followUp.wire},
      ),
    );
    return _interactionFromResponse(response);
  }

  /// Records arriving at a clinic the roteiro never suggested — §15.6.3.
  ///
  /// The timezone travels with the request for the same reason the calendar
  /// editor sends it: the anchor a visit is stored against is the rep's wall
  /// clock, and resolving it on the server would put a late arrival on the
  /// wrong day.
  @override
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/arrivals'),
        method: RepositoryHttpMethod.post,
        // Content-Type is load-bearing: without it Elysia parses no body at
        // all and answers 400 "Expected number" for a field that was sent.
        // The calendar mutations always set it; these four never did, so the
        // whole capture loop — start, complete, outcome, arrival — could not
        // work from the app. Invisible because no test crosses the real HTTP
        // layer, and nobody had pressed the buttons yet.
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: {
          'facilityId': facilityId,
          'timeZone': timeZone,
          'startedAt': startedAt ?? clientInstant(),
        },
      ),
    );
    return _interactionFromResponse(response);
  }

  InteractionDetail _interactionFromResponse(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwIfError(response);
    }
    return InteractionDetail.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Uri _calendarUri(
    String suffix, {
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) => _baseUri.replace(
    path: '/api/v1/calendar$suffix',
    queryParameters: {
      'from': from.toUtc().toIso8601String(),
      'to': to.toUtc().toIso8601String(),
      if (ownerUserId != null) 'ownerUserId': '$ownerUserId',
    },
  );

  Future<RepositoryHttpResponse> _call(Uri uri) => _callRequest(
    RepositoryHttpRequest(url: uri, method: RepositoryHttpMethod.get),
  );

  Future<RepositoryHttpResponse> _callRequest(
    RepositoryHttpRequest request,
  ) async {
    try {
      var response = await client.call(request: request);
      if (response.statusCode == 401) {
        await onErrorStatusCode(401);
        response = await client.call(request: request);
      }
      return response;
    } on CalendarApiException {
      rethrow;
    } on SessionExpiredException {
      try {
        return await client.call(request: request);
      } catch (_) {
        throw const CalendarNetworkException(
          'Sua sessão expirou. Entre novamente para acessar a agenda.',
        );
      }
    } catch (_) {
      throw const CalendarNetworkException(
        'Não foi possível acessar a agenda. Verifique sua conexão.',
      );
    }
  }

  Never _throwIfError(RepositoryHttpResponse response) {
    final payload = _errorPayload(response.body);
    final message = payload.message;
    switch (response.statusCode) {
      case 400:
      case 422:
        throw CalendarValidationException(message, details: payload.details);
      case 403:
        throw CalendarForbiddenException(message);
      case 409 when payload.code == 'INTERACTION_INVALID_TRANSITION':
        throw InteractionTransitionException(message);
      case 409 when payload.code == 'INTERACTION_VERSION_CONFLICT':
        throw InteractionVersionConflictException(
          message,
          expectedVersion: payload.expectedVersion,
          actualVersion: payload.actualVersion,
        );
      case 409 when payload.code == 'CALENDAR_VERSION_CONFLICT':
        throw CalendarVersionConflictException(
          message,
          calendarId: payload.calendarId,
          expectedVersion: payload.expectedVersion,
        );
      case 409:
        throw CalendarConflictException(message, conflicts: payload.conflicts);
      default:
        throw CalendarNetworkException(message);
    }
  }
}

class CalendarApiException implements Exception {
  const CalendarApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class CalendarForbiddenException extends CalendarApiException {
  const CalendarForbiddenException(super.message);
}

class CalendarConflictException extends CalendarApiException {
  const CalendarConflictException(super.message, {this.conflicts = const []});

  final List<CalendarConflict> conflicts;
}

class CalendarVersionConflictException extends CalendarApiException {
  const CalendarVersionConflictException(
    super.message, {
    this.calendarId,
    this.expectedVersion,
  });

  final int? calendarId;
  final int? expectedVersion;
}

class InteractionTransitionException extends CalendarApiException {
  const InteractionTransitionException(super.message);
}

class InteractionVersionConflictException extends CalendarApiException {
  const InteractionVersionConflictException(
    super.message, {
    this.expectedVersion,
    this.actualVersion,
  });

  final int? expectedVersion;
  final int? actualVersion;
}

class CalendarValidationException extends CalendarApiException {
  const CalendarValidationException(super.message, {this.details = const []});

  final List<Object?> details;
}

class CalendarNetworkException extends CalendarApiException {
  const CalendarNetworkException(super.message);
}

class _CalendarErrorPayload {
  const _CalendarErrorPayload({
    required this.code,
    required this.message,
    required this.details,
    required this.conflicts,
    this.calendarId,
    this.expectedVersion,
    this.actualVersion,
  });

  final String? code;
  final String message;
  final List<Object?> details;
  final List<CalendarConflict> conflicts;
  final int? calendarId;
  final int? expectedVersion;
  final int? actualVersion;
}

List<CalendarConflict> _readConflicts(List<dynamic> raw) {
  final conflicts = <CalendarConflict>[];
  for (final entry in raw) {
    if (entry is! Map<String, dynamic>) continue;
    try {
      conflicts.add(CalendarConflict.fromJson(entry));
    } catch (_) {
      // Skip the one we cannot read; keep the rest.
    }
  }
  return List.unmodifiable(conflicts);
}

_CalendarErrorPayload _errorPayload(String body) {
  try {
    final decoded = jsonDecode(body) as Map<String, dynamic>;
    final nested = decoded['error'];
    final error = nested is Map<String, dynamic> ? nested : decoded;
    final detailsRaw = error['details'] ?? error['errors'];
    final conflictsRaw = error['conflicts'] as List<dynamic>? ?? const [];
    return _CalendarErrorPayload(
      code: error['code'] as String?,
      message:
          error['message'] as String? ??
          (detailsRaw is String ? detailsRaw : null) ??
          'Não foi possível concluir a solicitação.',
      details: detailsRaw is List<dynamic> ? detailsRaw : const [],
      // Guarded on its own: a conflict this client cannot read is a reason to
      // lose that conflict, not to lose the server's message, its code and
      // every other conflict with it. That is what used to happen, and it
      // turned a precise 409 into "não foi possível concluir a solicitação".
      conflicts: _readConflicts(conflictsRaw),
      calendarId: readCrmIdOrNull(error['calendarId'], 'calendarId'),
      expectedVersion: error['expectedVersion'] as int?,
      actualVersion: error['actualVersion'] as int?,
    );
  } catch (_) {
    return const _CalendarErrorPayload(
      code: null,
      message: 'Não foi possível concluir a solicitação.',
      details: [],
      conflicts: [],
    );
  }
}

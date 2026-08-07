import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'calendar_models.dart';

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

  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
  });

  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
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
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id/start'),
        method: RepositoryHttpMethod.post,
        headers: {'Idempotency-Key': idempotencyKey},
        body: {'expectedVersion': expectedVersion},
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
  }) async {
    final response = await _callRequest(
      RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/interactions/$id/complete'),
        method: RepositoryHttpMethod.post,
        headers: {'Idempotency-Key': idempotencyKey},
        body: {
          'expectedVersion': expectedVersion,
          if (correctionReason != null && correctionReason.trim().isNotEmpty)
            'correctionReason': correctionReason.trim(),
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
      conflicts: conflictsRaw
          .cast<Map<String, dynamic>>()
          .map(CalendarConflict.fromJson)
          .toList(growable: false),
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

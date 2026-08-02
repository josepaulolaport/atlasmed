import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

import 'calendar_models.dart';

abstract interface class CalendarRepositoryContract {
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  });

  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  });
}

class CalendarRepository implements CalendarRepositoryContract {
  CalendarRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUri = Uri.parse(baseUrl ?? AppConfig.apiBaseUrl),
      _client =
          client ??
          createPlatformHttpClient(
            tokenBuilder: SessionEnvironment.instance.tokenBuilder,
          );

  final Uri _baseUri;
  final RepositoryHttpClient _client;

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
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
    String? ownerUserId,
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
    final map = decoded is Map<String, dynamic>
        ? decoded
        : const <String, dynamic>{};
    final data =
        (map['data'] ?? map['busy'] ?? map['intervals']) as List<dynamic>? ??
        const [];
    return data
        .cast<Map<String, dynamic>>()
        .map(CalendarAvailabilityInterval.fromJson)
        .toList(growable: false);
  }

  Uri _calendarUri(
    String suffix, {
    required DateTime from,
    required DateTime to,
    String? ownerUserId,
  }) => _baseUri.replace(
    path: '/api/v1/calendar$suffix',
    queryParameters: {
      'from': from.toUtc().toIso8601String(),
      'to': to.toUtc().toIso8601String(),
      if (ownerUserId != null && ownerUserId.isNotEmpty)
        'ownerUserId': ownerUserId,
    },
  );

  Future<RepositoryHttpResponse> _call(Uri uri) async {
    try {
      return await _client.call(
        request: RepositoryHttpRequest(
          url: uri,
          method: RepositoryHttpMethod.get,
        ),
      );
    } on CalendarApiException {
      rethrow;
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
      case 403:
        throw CalendarForbiddenException(message);
      case 409:
        throw CalendarConflictException(message, conflicts: payload.conflicts);
      case 422:
        throw CalendarValidationException(message);
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

  final List<CalendarAvailabilityInterval> conflicts;
}

class CalendarValidationException extends CalendarApiException {
  const CalendarValidationException(super.message);
}

class CalendarNetworkException extends CalendarApiException {
  const CalendarNetworkException(super.message);
}

class _CalendarErrorPayload {
  const _CalendarErrorPayload({required this.message, required this.conflicts});

  final String message;
  final List<CalendarAvailabilityInterval> conflicts;
}

_CalendarErrorPayload _errorPayload(String body) {
  try {
    final decoded = jsonDecode(body) as Map<String, dynamic>;
    final nested = decoded['error'];
    final error = nested is Map<String, dynamic> ? nested : decoded;
    final conflictsRaw = error['conflicts'] as List<dynamic>? ?? const [];
    return _CalendarErrorPayload(
      message:
          error['message'] as String? ??
          error['details'] as String? ??
          'Não foi possível concluir a solicitação.',
      conflicts: conflictsRaw
          .cast<Map<String, dynamic>>()
          .map(CalendarAvailabilityInterval.fromJson)
          .toList(growable: false),
    );
  } catch (_) {
    return const _CalendarErrorPayload(
      message: 'Não foi possível concluir a solicitação.',
      conflicts: [],
    );
  }
}

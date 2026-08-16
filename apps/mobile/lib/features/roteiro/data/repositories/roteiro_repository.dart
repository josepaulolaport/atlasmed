import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class RoteiroRepository extends Repository<String>
    with SessionEnvironmentMixin<String> {
  RoteiroRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client = client,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/roteiros',
        ),
        name: 'RoteiroRepository',
        resolveOnCreate: false,
      );

  final String _baseUrl;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  /// Records that the rep pulled a clinic out of the slate.
  ///
  /// Written on removal rather than on save, because a preview is never
  /// persisted and a rep does all their rejecting in the draft. Fire-and-forget
  /// from the caller's point of view: losing a rejection must never block the
  /// removal the rep asked for.
  Future<RoteiroRejection?> reject({
    required int verticalId,
    required int facilityVerticalProfileId,
    int? roteiroId,
    int? position,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/rejections'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'verticalId': verticalId,
          'facilityVerticalProfileId': facilityVerticalProfileId,
          'roteiroId': ?roteiroId,
          'position': ?position,
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) return null;
    return RoteiroRejection.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Attaches the rep's reason to a rejection already recorded.
  Future<void> explainRejection({
    required int rejectionId,
    required RoteiroRejectionReason reason,
    String? note,
  }) async {
    await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/rejections/$rejectionId'),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {'reason': reason.wire, 'note': ?note},
      ),
    );
  }

  /// Generates a slate from the rep's live position.
  ///
  /// `latitude`/`longitude` are required and have no fallback: the server
  /// refuses a guessed origin (spec 0016 §4.1), because drive times computed
  /// from an averaged position look exactly as confident as real ones.
  /// Generates without persisting — the workspace's draft.
  ///
  /// `/preview` rather than `/roteiros`: a rep regenerating while they shape the
  /// day should not be writing a row each time, and nothing is real until they
  /// save. Persisting on every keystroke would also make `last_suggested_at`
  /// meaningless, since a discarded draft would mark clinics as covered.
  Future<Roteiro> generate({
    required int verticalId,
    String? scopeDate,
    double? latitude,
    double? longitude,
    int? limit,
    int? subjectUserId,
    List<int> excludeProfileIds = const [],
    List<int> includeProfileIds = const [],
    Map<int, int> durationOverrides = const {},
    Map<int, DateTime> startOverrides = const {},
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/preview'),
        method: RepositoryHttpMethod.post,
        // Required: the shared client JSON-encodes the body but sets no
        // content type, so without this Elysia never parses it and the request
        // fails schema validation with a 400 that says nothing.
        headers: const {'Content-Type': 'application/json'},
        body: {
          'verticalId': verticalId,
          'scopeDate': ?scopeDate,
          if (latitude != null && longitude != null)
            'origin': {'lat': latitude, 'lng': longitude},
          'limit': ?limit,
          'subjectUserId': ?subjectUserId,
          if (excludeProfileIds.isNotEmpty)
            'excludeProfileIds': excludeProfileIds,
          if (includeProfileIds.isNotEmpty)
            'includeProfileIds': includeProfileIds,
          // Sent to the engine rather than applied to its answer: how long a
          // visit takes is the denominator of the gain a stop is chosen on, so
          // a two-hour hospital planned as one hour displaces a clinic that
          // would have fitted.
          if (durationOverrides.isNotEmpty)
            'durationOverrides': durationOverrides.map(
              (id, minutes) => MapEntry('$id', minutes),
            ),
          // A pinned time is planned as a commitment, so it survives the
          // re-plan a save performs. Without this the rep would watch their own
          // edit get undone by the engine.
          if (startOverrides.isNotEmpty)
            'startOverrides': startOverrides.map(
              (id, at) => MapEntry('$id', at.toUtc().toIso8601String()),
            ),
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível gerar o roteiro.');
      }
    }
    return Roteiro.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// The rep's own clinics for the linha, for the add picker.
  Future<List<AddableClinic>> addable({
    required int verticalId,
    String? query,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/addable').replace(
          queryParameters: {
            'verticalId': '$verticalId',
            if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
          },
        ),
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) throw StateError('Não foi possível buscar clínicas.');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return ((body['data'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => AddableClinic.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Persists the shaped slate, then writes it into the agenda.
  ///
  /// Two calls rather than one because persisting and confirming are separate
  /// concerns server-side — and because a 409 on confirm has to be
  /// distinguishable from a failure to save at all.
  Future<Roteiro> save({
    required int verticalId,
    String? scopeDate,
    double? latitude,
    double? longitude,
    int? limit,
    List<int> excludeProfileIds = const [],
    List<int> includeProfileIds = const [],
    Map<int, int> durationOverrides = const {},
    Map<int, DateTime> startOverrides = const {},
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros'),
        method: RepositoryHttpMethod.post,
        // Required: the shared client JSON-encodes the body but sets no
        // content type, so without this Elysia never parses it and the request
        // fails schema validation with a 400 that says nothing.
        headers: const {'Content-Type': 'application/json'},
        body: {
          'verticalId': verticalId,
          'scopeDate': ?scopeDate,
          if (latitude != null && longitude != null)
            'origin': {'lat': latitude, 'lng': longitude},
          'limit': ?limit,
          if (excludeProfileIds.isNotEmpty)
            'excludeProfileIds': excludeProfileIds,
          if (includeProfileIds.isNotEmpty)
            'includeProfileIds': includeProfileIds,
          // Sent to the engine rather than applied to its answer: how long a
          // visit takes is the denominator of the gain a stop is chosen on, so
          // a two-hour hospital planned as one hour displaces a clinic that
          // would have fitted.
          if (durationOverrides.isNotEmpty)
            'durationOverrides': durationOverrides.map(
              (id, minutes) => MapEntry('$id', minutes),
            ),
          // A pinned time is planned as a commitment, so it survives the
          // re-plan a save performs. Without this the rep would watch their own
          // edit get undone by the engine.
          if (startOverrides.isNotEmpty)
            'startOverrides': startOverrides.map(
              (id, at) => MapEntry('$id', at.toUtc().toIso8601String()),
            ),
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) throw StateError('Não foi possível salvar o roteiro.');
    }
    final draft = Roteiro.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    final id = draft.id;
    if (id == null) throw StateError('Não foi possível salvar o roteiro.');

    // Confirm for its effect, not its answer.
    //
    // `POST /roteiros` returns the planned day — clinic names, cities,
    // distances, travel between stops, the reasons each was chosen.
    // `POST /roteiros/:id/confirm` returns the stored row, which carries none
    // of that. Returning it replaced the slate the rep had just approved with
    // five cards reading "Clínica", no distances and "0 min" of travel: the
    // save looked like it had emptied the day it had in fact just written.
    //
    // The confirm still has to happen and still has to be able to fail — a 409
    // means the calendar moved under the plan — but the day to show afterwards
    // is the one that was planned.
    await confirm(id);
    return draft;
  }

  /// Writes the roteiro into the agent's agenda.
  ///
  /// Idempotent server-side, so a retry after a dropped connection cannot
  /// double-book the day. A 409 means the calendar changed since the plan was
  /// generated — the times are never silently shifted, so the rep regenerates.
  Future<Roteiro> confirm(int roteiroId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/$roteiroId/confirm'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: const {},
      ),
    );
    if (response.statusCode == 409) {
      throw const RoteiroConflictException();
    }
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível confirmar o roteiro.');
      }
    }
    return Roteiro.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}

/// The agenda changed since the roteiro was generated.
class RoteiroConflictException implements Exception {
  const RoteiroConflictException();

  @override
  String toString() =>
      'Sua agenda mudou desde que o roteiro foi gerado. Gere novamente para ver os horários atuais.';
}

import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Why an assignment ended (spec 0015 R7).
///
/// Chosen, never typed. `end_reason` is kept forever (I5), so it is the only
/// account of why a clinic left a rep — and free text is churn nobody can
/// aggregate, which is churn nobody can explain later.
enum UnassignReason {
  repChanged('rep_changed', 'Mudou de representante'),
  clinicClosed('clinic_closed', 'Clínica fechada ou inativa'),
  wrongAssignment('wrong_assignment', 'Atribuição incorreta'),

  /// `other`, not `manual_unassign`: that code means "reason unrecorded" —
  /// what the API writes for a legacy row or a caller that sent nothing — so
  /// sending it for a deliberate choice made the choice invisible.
  other('other', 'Outro motivo');

  const UnassignReason(this.wireValue, this.label);

  final String wireValue;
  final String label;
}

/// A clinic that could be given to someone (spec 0015 R6).
class AssignableClinic {
  const AssignableClinic({
    required this.facilityId,
    required this.name,
    required this.city,
    required this.state,
    required this.requiresReason,
    this.currentRepName,
    this.currentRepId,
  });

  final int facilityId;
  final String name;
  final String city;
  final String state;

  /// Whoever holds it now. The confirmation names them, because taking a clinic
  /// over ends someone else's assignment.
  final String? currentRepName;
  final int? currentRepId;

  /// No patch of theirs covers it, so I2 is satisfied by an override rather
  /// than by geometry. Decided by the server — the client cannot see polygons.
  final bool requiresReason;

  String get locationLabel =>
      [city, state].where((s) => s.isNotEmpty).join(' · ');

  factory AssignableClinic.fromJson(Map<String, dynamic> json) {
    return AssignableClinic(
      facilityId: readCrmId(json['facilityId'], 'facilityId'),
      name: json['name'] as String? ?? '',
      city: json['city'] as String? ?? '',
      state: json['state'] as String? ?? '',
      currentRepName: json['currentRepName'] as String?,
      currentRepId: json['currentRepId'] == null
          ? null
          : readCrmId(json['currentRepId'], 'currentRepId'),
      requiresReason: json['requiresReason'] as bool? ?? true,
    );
  }
}

class ClinicAssignmentException implements Exception {
  const ClinicAssignmentException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Assigning and unassigning clinics from a member's profile (spec 0015 §5).
///
/// A plain client rather than a `Repository`: these are commands, not cached
/// reads, and the screens invalidate the lists themselves afterwards.
class ClinicAssignmentRepository {
  ClinicAssignmentRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1$path').replace(queryParameters: query);

  Future<RepositoryHttpResponse> _send(
    Uri url,
    RepositoryHttpMethod method, [
    Map<String, dynamic>? body,
  ]) => _client.call(
    request: RepositoryHttpRequest(
      url: url,
      method: method,
      body: body,
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    // The message is the server's when it bothered to send one: a refused
    // assignment usually says something the user can act on ("fora do
    // território", "sem acesso a esta linha"), and "Erro 400" does not.
    String message = 'Erro ${response.statusCode}';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      }
    } catch (_) {
      // Body was not JSON; the status code is all we have.
    }
    throw ClinicAssignmentException(message);
  }

  /// Clinics this rep could take. [search] is required by the API in search
  /// mode — see spec 0015 R6 on why an untermed scan is refused.
  Future<({List<AssignableClinic> data, int total})> listAssignable({
    required int userId,
    required int verticalId,
    required bool searchMode,
    String? search,
    int page = 1,
    int limit = 25,
  }) async {
    final response = await _send(
      _uri('/team/members/$userId/assignable-clinics', {
        'verticalId': '$verticalId',
        'mode': searchMode ? 'search' : 'patch',
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'page': '$page',
        'limit': '$limit',
      }),
      RepositoryHttpMethod.get,
    );
    _throwIfError(response);

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((row) => AssignableClinic.fromJson(Map<String, dynamic>.from(row)))
        .toList(growable: false);
    final total =
        (decoded['pagination'] as Map<String, dynamic>?)?['total'] as int? ??
        rows.length;

    return (data: rows, total: total);
  }

  /// Assign, or take over. [overrideReason] satisfies I2 in place of patch
  /// coverage (spec 0009 R2) and is required when the clinic sits outside.
  Future<void> assign({
    required int facilityId,
    required int verticalId,
    required int userId,
    String? overrideReason,
  }) async {
    final response = await _send(
      _uri('/facilities/$facilityId/verticals/$verticalId/rep'),
      RepositoryHttpMethod.put,
      {
        'userId': userId,
        if (overrideReason != null && overrideReason.trim().isNotEmpty)
          'overrideReason': overrideReason.trim(),
      },
    );
    _throwIfError(response);
  }

  Future<void> unassign({
    required int facilityId,
    required int verticalId,
    required UnassignReason reason,
  }) async {
    final response = await _send(
      _uri('/facilities/$facilityId/verticals/$verticalId/rep', {
        'reason': reason.wireValue,
      }),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }
}

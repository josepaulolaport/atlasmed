import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class FacilityVerticalRepAssignmentsException implements Exception {
  const FacilityVerticalRepAssignmentsException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityVerticalRepAssignmentsException';
}

/// Clinic×vertical REP ownership
/// (`/facilities/:facilityId/verticals/:verticalId/rep`).
///
/// Display DTO fields remain `consultantName` / `consultantSince` on facility.
class FacilityVerticalRepAssignmentsRepository {
  FacilityVerticalRepAssignmentsRepository(
    this.facilityId, {
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
       _client =
           client ??
           createPlatformHttpClient(
             tokenBuilder: SessionEnvironment.instance.tokenBuilder,
           );

  final int facilityId;
  final String _baseUrl;
  final RepositoryHttpClient _client;

  Uri _repEndpoint(int verticalId) => Uri.parse(
    '$_baseUrl/api/v1/facilities/$facilityId/verticals/$verticalId/rep',
  );

  Future<void> assign({required int userId, required int verticalId}) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _repEndpoint(verticalId),
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: {'userId': userId},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityVerticalRepAssignmentsException(
        _messageFromBody(response.body) ??
            'Não foi possível atribuir o consultor (${response.statusCode})',
      );
    }
  }

  Future<void> unassign({required int verticalId}) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _repEndpoint(verticalId),
        method: RepositoryHttpMethod.delete,
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityVerticalRepAssignmentsException(
        _messageFromBody(response.body) ??
            'Não foi possível remover o consultor (${response.statusCode})',
      );
    }
  }

  String? _messageFromBody(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return null;
  }
}

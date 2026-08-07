import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class FacilityConsultantAssignmentsException implements Exception {
  const FacilityConsultantAssignmentsException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityConsultantAssignmentsException';
}

/// Clinic commercial ownership (`/facilities/:id/consultant-assignments`).
class FacilityConsultantAssignmentsRepository {
  FacilityConsultantAssignmentsRepository(this.facilityId, {String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final int facilityId;
  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri get _endpoint => Uri.parse(
    '$_baseUrl/api/v1/facilities/$facilityId/consultant-assignments',
  );

  Future<void> assign({required int userId, int? verticalId}) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'userId': userId, 'verticalId': ?verticalId},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityConsultantAssignmentsException(
        _messageFromBody(response.body) ??
            'Não foi possível atribuir o consultor (${response.statusCode})',
      );
    }
  }

  Future<void> unassignCurrent() async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_endpoint/current'),
        method: RepositoryHttpMethod.delete,
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityConsultantAssignmentsException(
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

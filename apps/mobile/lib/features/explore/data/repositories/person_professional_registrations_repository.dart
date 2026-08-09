import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_registration.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class PersonProfessionalRegistrationsException implements Exception {
  const PersonProfessionalRegistrationsException([this.message]);
  final String? message;

  @override
  String toString() => message ?? 'PersonProfessionalRegistrationsException';
}

/// Person-scoped registration list/CRUD.
class PersonProfessionalRegistrationsRepository
    extends Repository<List<ProfessionalRegistration>>
    with SessionEnvironmentMixin<List<ProfessionalRegistration>> {
  PersonProfessionalRegistrationsRepository(
    this.personId, {
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/persons/$personId'
           '/professional-registrations',
         ),
         resolveOnCreate: true,
         name: 'PersonProfessionalRegistrationsRepository',
       );

  final int personId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<ProfessionalRegistration> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map>()
        .map((e) => ProfessionalRegistration.fromMap(e.cast<String, dynamic>()))
        .toList(growable: false);
  }

  Future<ProfessionalRegistration> create({
    required int councilId,
    required String stateCode,
    required String registrationNumber,
    bool isPrimary = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'councilId': councilId,
          'stateCode': stateCode,
          'registrationNumber': registrationNumber,
          'isPrimary': isPrimary,
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw PersonProfessionalRegistrationsException(
        _errorMessage(response.body, response.statusCode),
      );
    }
    final created = ProfessionalRegistration.fromMap(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return created;
  }

  Future<ProfessionalRegistration> updateRegistration({
    required int registrationId,
    int? councilId,
    String? stateCode,
    String? registrationNumber,
    bool? isPrimary,
  }) async {
    // ignore_for_file: use_null_aware_elements — value-nullable map entries, not key-nullable.
    final body = <String, dynamic>{
      if (councilId != null) 'councilId': councilId,
      if (stateCode != null) 'stateCode': stateCode,
      if (registrationNumber != null) 'registrationNumber': registrationNumber,
      if (isPrimary != null) 'isPrimary': isPrimary,
    };
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${endpoint.toString()}/$registrationId'),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw PersonProfessionalRegistrationsException(
        _errorMessage(response.body, response.statusCode),
      );
    }
    final updated = ProfessionalRegistration.fromMap(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return updated;
  }

  Future<void> deactivate(int registrationId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${endpoint.toString()}/$registrationId'),
        method: RepositoryHttpMethod.delete,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw PersonProfessionalRegistrationsException(
        _errorMessage(response.body, response.statusCode),
      );
    }
    await refresh();
  }

  String _errorMessage(String body, int statusCode) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['error'] is Map) {
        final err = decoded['error'] as Map;
        final issues = err['issues'];
        if (issues is List && issues.isNotEmpty) {
          final first = issues.first;
          if (first is Map && first['message'] is String) {
            return first['message'] as String;
          }
        }
        if (err['message'] is String) return err['message'] as String;
      }
    } catch (_) {}
    return 'Falha ao salvar registro ($statusCode)';
  }
}

import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityNotesException implements Exception {
  const FacilityNotesException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityNotesException';
}

/// Private facility field notes (`GET/POST /facilities/:id/notes`).
class FacilityNotesRepository extends Repository<List<FacilityFieldNote>>
    with SessionEnvironmentMixin<List<FacilityFieldNote>> {
  FacilityNotesRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/notes',
        ),
        name: 'FacilityNotesRepository',
      );

  final int facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<FacilityFieldNote> fromJson(String json) {
    final data = jsonDecode(json) as List<dynamic>;
    return data
        .map((item) => _fromApi(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<FacilityFieldNote>> loadNotes() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityNotesException();
    }
    return result;
  }

  Future<FacilityFieldNote> createNote(String note) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'note': note},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityNotesException(
          'Falha ao salvar nota (${response.statusCode})',
        );
      }
    }

    final created = _fromApi(jsonDecode(response.body) as Map<String, dynamic>);
    await refresh();
    return created;
  }

  FacilityFieldNote _fromApi(Map<String, dynamic> map) {
    return FacilityFieldNote(
      id: readCrmId(map['id'], 'id'),
      text: map['note'] as String,
      createdAt: DateTime.parse(map['createdAt'] as String),
    );
  }
}

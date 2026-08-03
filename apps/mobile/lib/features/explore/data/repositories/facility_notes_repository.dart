import 'dart:convert';

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
  FacilityNotesRepository(
    this.facilityId, {
    this.ownerUserId,
    RepositoryHttpClient? client,
    String? baseUrl,
  }) : _client = client,
       _actorEndpoint = Uri.parse(
         '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/notes',
       ),
       super(
         endpoint:
             Uri.parse(
               '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/notes',
             ).replace(
               queryParameters: ownerUserId == null || ownerUserId.isEmpty
                   ? null
                   : {'ownerUserId': ownerUserId},
             ),
         resolveOnCreate: false,
         name: 'FacilityNotesRepository',
       );

  final String facilityId;
  final String? ownerUserId;
  final Uri _actorEndpoint;
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
    final response = await client.call(
      request: RepositoryHttpRequest(url: endpoint),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityNotesException(
          'Falha ao carregar notas (${response.statusCode})',
        );
      }
    }
    return fromJson(response.body);
  }

  Future<FacilityFieldNote> createNote(String note) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: _actorEndpoint,
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

    return _fromApi(jsonDecode(response.body) as Map<String, dynamic>);
  }

  FacilityFieldNote _fromApi(Map<String, dynamic> map) {
    return FacilityFieldNote(
      id: map['id'] as String,
      text: map['note'] as String,
      createdAt: DateTime.parse(map['createdAt'] as String),
    );
  }
}

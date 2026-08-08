import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Active role catalog — `GET /api/v1/person-facility-roles`.
class PersonFacilityRolesCatalogRepository
    extends Repository<List<PersonFacilityRoleCatalogEntry>>
    with SessionEnvironmentMixin<List<PersonFacilityRoleCatalogEntry>> {
  PersonFacilityRolesCatalogRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/person-facility-roles',
         ),
         name: 'PersonFacilityRolesCatalogRepository',
         resolveOnCreate: false,
       );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<PersonFacilityRoleCatalogEntry> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) {
      return const [];
    }
    final data = decoded['data'];
    if (data is! List) {
      return const [];
    }
    final entries = data
        .whereType<Map>()
        .map((e) => PersonFacilityRoleCatalogEntry.fromMap(
              e.cast<String, dynamic>(),
            ))
        .where((e) => e.id != 0 && e.name.isNotEmpty)
        .toList(growable: false);
    PersonFacilityRoleCatalogCache.replace(entries);
    return entries;
  }

  Future<List<PersonFacilityRoleCatalogEntry>> listActive() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.get,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw StateError(
        'Falha ao carregar papéis (${response.statusCode})',
      );
    }
    return fromJson(response.body);
  }
}

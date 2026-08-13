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
        .map(
          (e) =>
              PersonFacilityRoleCatalogEntry.fromMap(e.cast<String, dynamic>()),
        )
        .where((e) => e.id != 0 && e.name.isNotEmpty)
        .toList(growable: false);
    PersonFacilityRoleCatalogCache.replace(entries);
    return entries;
  }

  /// One in-flight warm across every instance.
  ///
  /// The catalog lives in a static cache, but each caller built its own
  /// repository, fetched, and disposed it — so the cache was written and the
  /// instance that wrote it thrown away. Two callers warm it on a clinic open
  /// (the representatives roster and the professionals roster), and they run
  /// concurrently, so checking the cache alone would not help: both would find
  /// it empty and both would fetch. Measured 2026-08-13: two
  /// `/person-facility-roles` requests per clinic open, 39-135ms apart
  /// depending on which chain won.
  static Future<void>? _warming;

  /// Populate the shared catalog cache if it is not already populated.
  ///
  /// For callers that only need id→name labels to resolve. Anything that needs
  /// the current server state — the role-editing sheets — should keep calling
  /// [listActive], which always fetches.
  Future<void> ensureCatalogWarm() async {
    if (PersonFacilityRoleCatalogCache.entries.isNotEmpty) return;
    // Cleared on completion so a failed warm is retried rather than remembered
    // as done. A successful one needs no flag: the cache is no longer empty.
    _warming ??= listActive().then((_) {}).whenComplete(() {
      _warming = null;
    });
    await _warming;
  }

  /// Drops the in-flight warm. Pair with [PersonFacilityRoleCatalogCache.resetForTest].
  static void resetWarmForTest() {
    _warming = null;
  }

  Future<List<PersonFacilityRoleCatalogEntry>> listActive() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.get,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw StateError('Falha ao carregar papéis (${response.statusCode})');
    }
    return fromJson(response.body);
  }
}

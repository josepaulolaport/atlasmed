import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityPotentialException implements Exception {
  const FacilityPotentialException([this.message]);
  final String? message;
}

/// `GET /facilities/:id/potentials` plus per-competitor usage writes.
class FacilityPotentialRepository extends Repository<FacilityPotentialsPage>
    with SessionEnvironmentMixin<FacilityPotentialsPage> {
  FacilityPotentialRepository({
    required this.facilityId,
    required this.verticalId,
    RepositoryHttpClient? client,
  }) : _injectedClient = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/potentials'
           '?verticalId=$verticalId',
         ),
         name: 'FacilityPotentialRepository',
       );

  final int facilityId;
  final int verticalId;
  final RepositoryHttpClient? _injectedClient;

  @override
  RepositoryHttpClient get client => _injectedClient ?? super.client;

  @override
  FacilityPotentialsPage fromJson(String json) =>
      FacilityPotentialsPage.fromJson(jsonDecode(json) as Map<String, dynamic>);

  Future<FacilityPotentialsPage> load() async {
    final page = await currentValueOrResolve();
    if (page == null) throw const FacilityPotentialException();
    return page;
  }

  /// Sets one competitor product's monthly quantity for one metric.
  /// The rep supplies only the quantity — spec 0013 §6.
  Future<FacilityPotentialsPage> setCompetitorQuantity({
    required int definitionId,
    required int productId,
    required double quantity,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/potentials'
          '/$definitionId/usage/$productId',
        ),
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: {'verticalId': verticalId, 'quantity': quantity},
      ),
    );
    return _decode(response, 'Falha ao salvar a quantidade');
  }

  Future<FacilityPotentialsPage> removeCompetitor({
    required int definitionId,
    required int productId,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/potentials'
          '/$definitionId/usage/$productId?verticalId=$verticalId',
        ),
        method: RepositoryHttpMethod.delete,
      ),
    );
    return _decode(response, 'Falha ao remover a marca');
  }

  FacilityPotentialsPage _decode(dynamic response, String failureMessage) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityPotentialException(
        '$failureMessage (${response.statusCode})',
      );
    }
    return FacilityPotentialsPage.fromJson(
      jsonDecode(response.body as String) as Map<String, dynamic>,
    );
  }
}

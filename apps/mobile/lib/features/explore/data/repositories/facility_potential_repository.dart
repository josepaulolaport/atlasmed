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

/// `GET/PATCH /facilities/:id/potentials`.
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

  final String facilityId;
  final String verticalId;
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

  Future<FacilityPotentialsPage> patchValues(
    List<({String definitionId, double? quantity})> values,
  ) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/potentials',
        ),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'verticalId': verticalId,
          'values': values
              .map(
                (v) => {'definitionId': v.definitionId, 'quantity': v.quantity},
              )
              .toList(growable: false),
        },
      ),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityPotentialException(
        'Falha ao salvar potencial (${response.statusCode})',
      );
    }

    return FacilityPotentialsPage.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }
}

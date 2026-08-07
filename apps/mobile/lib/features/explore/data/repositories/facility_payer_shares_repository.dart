import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_payer_share_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityPayerSharesException implements Exception {
  const FacilityPayerSharesException([this.message]);

  final String? message;
}

/// Facility Fontes Pagadoras mix (`healthcare-provider-shares`).
class FacilityPayerSharesRepository
    extends Repository<FacilityPayerSharesResponse>
    with SessionEnvironmentMixin<FacilityPayerSharesResponse> {
  FacilityPayerSharesRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/healthcare-provider-shares',
        ),
        name: 'FacilityPayerSharesRepository',
      );

  final int facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  FacilityPayerSharesResponse fromJson(String json) =>
      FacilityPayerSharesResponse.fromJson(json);

  Future<List<PayerShare>> loadShares() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityPayerSharesException();
    }
    return result.toDomain();
  }

  /// Replace the full mix. Empty [payers] clears all shares.
  Future<List<PayerShare>> replaceShares(List<PayerShare> payers) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'shares': payers
              .map(
                (p) => {
                  'healthcareProviderId': p.id,
                  'sharePercent': p.sharePercent,
                  'isPackage': p.isPackage,
                },
              )
              .toList(growable: false),
        },
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityPayerSharesException(
          'Falha ao salvar fontes pagadoras (${response.statusCode})',
        );
      }
    }

    final parsed = FacilityPayerSharesResponse.fromJson(response.body);
    return parsed.toDomain();
  }
}

/// Active healthcare providers for the Fontes Pagadoras catalog picker.
class HealthcareProvidersRepository
    extends Repository<PaginatedHealthcareProviders>
    with SessionEnvironmentMixin<PaginatedHealthcareProviders> {
  HealthcareProvidersRepository({
    this.page = 1,
    this.limit = 100,
    this.isActive = true,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/healthcare-providers'
           '?page=$page&limit=$limit&isActive=${isActive ? 'true' : 'false'}',
         ),
         name: 'HealthcareProvidersRepository',
       );

  final int page;
  final int limit;
  final bool isActive;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedHealthcareProviders fromJson(String json) =>
      PaginatedHealthcareProviders.fromJson(json);

  Future<List<HealthcareProviderApi>> loadProviders() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityPayerSharesException();
    }
    return result.items;
  }

  /// `POST /healthcare-providers` — requires `create:CATALOG`.
  Future<HealthcareProviderApi> createProvider({
    required String name,
    String type = 'PRIVATE',
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/healthcare-providers'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'name': name.trim(), 'type': type, 'isActive': true},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityPayerSharesException(
          response.statusCode == 403
              ? 'Sem permissão para criar fonte pagadora'
              : 'Falha ao criar fonte pagadora (${response.statusCode})',
        );
      }
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const FacilityPayerSharesException(
        'Resposta inválida ao criar fonte pagadora',
      );
    }
    return HealthcareProviderApi.fromMap(decoded.cast<String, dynamic>());
  }
}

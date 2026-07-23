import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilitiesWriteException implements Exception {
  const FacilitiesWriteException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilitiesWriteException';
}

class GeocodeResult {
  const GeocodeResult({
    required this.latitude,
    required this.longitude,
    this.placeName,
  });

  final double latitude;
  final double longitude;
  final String? placeName;
}

/// Create facilities + forward geocode (Mapbox via API).
class FacilitiesWriteRepository extends Repository<Map<String, dynamic>>
    with SessionEnvironmentMixin<Map<String, dynamic>> {
  FacilitiesWriteRepository({RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/facilities'),
        resolveOnCreate: false,
        name: 'FacilitiesWriteRepository',
      );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  Map<String, dynamic> fromJson(String json) {
    return jsonDecode(json) as Map<String, dynamic>;
  }

  Future<GeocodeResult> geocodeForward(String query) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/maps/geocode/forward',
    ).replace(queryParameters: {'q': query, 'country': 'br', 'limit': '1'});

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: uri,
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilitiesWriteException(
          response.statusCode == 403
              ? 'Sem permissão para geocodificar.'
              : response.statusCode == 500 || response.statusCode == 503
              ? 'Geocodificação indisponível. Verifique o token Mapbox na API.'
              : 'Falha ao geocodificar (${response.statusCode})',
        );
      }
    }

    if (response.body.isEmpty || response.body == 'null') {
      throw const FacilitiesWriteException(
        'Não encontramos coordenadas para este endereço.',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const FacilitiesWriteException(
        'Não encontramos coordenadas para este endereço.',
      );
    }

    // API returns `{ data: GeocodeResult | null }` (same as web mapsApi).
    final payload = decoded['data'] is Map<String, dynamic>
        ? decoded['data'] as Map<String, dynamic>
        : decoded;

    final lat = (payload['latitude'] as num?)?.toDouble();
    final lng = (payload['longitude'] as num?)?.toDouble();
    if (lat == null || lng == null) {
      throw const FacilitiesWriteException(
        'Não encontramos coordenadas para este endereço.',
      );
    }
    return GeocodeResult(
      latitude: lat,
      longitude: lng,
      placeName:
          payload['fullAddress'] as String? ?? payload['name'] as String?,
    );
  }

  Future<String> createFacility(Map<String, dynamic> body) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilitiesWriteException(
          response.statusCode == 403
              ? 'Sem permissão para criar clínica.'
              : 'Falha ao criar clínica (${response.statusCode})',
        );
      }
    }

    final map = fromJson(response.body);
    final id = map['id'] as String?;
    if (id == null || id.isEmpty) {
      throw const FacilitiesWriteException(
        'Resposta inválida ao criar clínica.',
      );
    }
    return id;
  }
}

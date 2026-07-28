import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class PotentialDefinition {
  const PotentialDefinition({
    required this.id,
    required this.verticalId,
    required this.key,
    required this.label,
    required this.sortOrder,
  });

  final String id;
  final String verticalId;
  final String key;
  final String label;
  final int sortOrder;

  factory PotentialDefinition.fromJson(Map<String, dynamic> json) {
    return PotentialDefinition(
      id: json['id'] as String,
      verticalId: json['verticalId'] as String,
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}

class LinkedPotentialProduct {
  const LinkedPotentialProduct({
    required this.productId,
    required this.definitionId,
    required this.name,
    required this.code,
  });

  final String productId;
  final String definitionId;
  final String name;
  final String code;

  factory LinkedPotentialProduct.fromJson(Map<String, dynamic> json) {
    return LinkedPotentialProduct(
      productId: json['productId'] as String,
      definitionId: json['definitionId'] as String,
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
    );
  }
}

class PotentialDefinitionsException implements Exception {
  const PotentialDefinitionsException([this.message]);
  final String? message;
}

/// Admin API for potential metric definitions + product links.
class PotentialDefinitionsRepository {
  PotentialDefinitionsRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1$path').replace(queryParameters: query);

  Future<RepositoryHttpResponse> _send(
    Uri url,
    RepositoryHttpMethod method, [
    Map<String, dynamic>? body,
  ]) => _client.call(
    request: RepositoryHttpRequest(
      url: url,
      method: method,
      body: body,
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PotentialDefinitionsException('Erro ${response.statusCode}');
    }
  }

  Future<List<PotentialDefinition>> list(String verticalId) async {
    final response = await _send(
      _uri('/potential-definitions', {'verticalId': verticalId}),
      RepositoryHttpMethod.get,
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map(
          (row) => PotentialDefinition.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  Future<PotentialDefinition> create({
    required String verticalId,
    required String label,
    String? key,
    int? sortOrder,
  }) async {
    final response = await _send(
      _uri('/potential-definitions'),
      RepositoryHttpMethod.post,
      {
        'verticalId': verticalId,
        'label': label,
        'key': ?key,
        'sortOrder': ?sortOrder,
      },
    );
    _throwIfError(response);
    return PotentialDefinition.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<PotentialDefinition> update({
    required String id,
    String? label,
    int? sortOrder,
  }) async {
    final response = await _send(
      _uri('/potential-definitions/$id'),
      RepositoryHttpMethod.patch,
      {'label': ?label, 'sortOrder': ?sortOrder},
    );
    _throwIfError(response);
    return PotentialDefinition.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<void> softDelete(String id) async {
    final response = await _send(
      _uri('/potential-definitions/$id'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  Future<List<LinkedPotentialProduct>> listProducts(String definitionId) async {
    final response = await _send(
      _uri('/potential-definitions/$definitionId/products'),
      RepositoryHttpMethod.get,
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map(
          (row) =>
              LinkedPotentialProduct.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  Future<void> linkProduct({
    required String productId,
    required String definitionId,
  }) async {
    final response = await _send(
      _uri('/products/$productId/potential-definition'),
      RepositoryHttpMethod.put,
      {'definitionId': definitionId},
    );
    _throwIfError(response);
  }

  Future<void> unlinkProduct(String productId) async {
    final response = await _send(
      _uri('/products/$productId/potential-definition'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }
}

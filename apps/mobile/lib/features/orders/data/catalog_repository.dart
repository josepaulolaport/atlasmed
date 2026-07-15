import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/repositories/mixins/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/orders/data/catalog_product.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

abstract class CatalogRepository {
  Future<CatalogProductPage> getProducts({
    required int page,
    required int limit,
    String? search,
  });

  Future<CatalogProduct> getProduct(String id);
}

class ApiCatalogRepository extends Repository<String>
    with SessionEnvironmentMixin<String>
    implements CatalogRepository {
  ApiCatalogRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client = client,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/products',
        ),
        name: 'ApiCatalogRepository',
        resolveOnCreate: false,
      );

  final String _baseUrl;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  Future<CatalogProductPage> getProducts({
    required int page,
    required int limit,
    String? search,
  }) async {
    final queryParameters = <String, String>{
      'page': '$page',
      'limit': '$limit',
      'isActive': 'true',
      if (search?.trim().isNotEmpty ?? false) 'search': search!.trim(),
    };
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '$_baseUrl/api/v1/products',
        ).replace(queryParameters: queryParameters),
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível carregar os produtos.');
      }
    }
    return CatalogProductPage.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<CatalogProduct> getProduct(String id) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/products/$id'),
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível carregar o produto.');
      }
    }
    return CatalogProduct.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }
}

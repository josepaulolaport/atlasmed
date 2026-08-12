import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_business_vertical.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real, API-backed data source for the Catálogo de Produtos feature.
///
/// Talks to the catalog module of the API (`/api/v1/products`,
/// `/api/v1/competitor-products`, `/api/v1/products/:id/comparison`,
/// `/api/v1/price-index`, `/api/v1/business-verticals`) — see
/// `apps/api/src/modules/catalog` for the server side. Follows the same
/// thin-wrapper shape as `HttpTerritoryRepository`: a plain
/// [RepositoryHttpClient] with bearer-token injection via
/// [SessionEnvironment], `_get`/`_send` helpers, and [CatalogApiException]
/// for structured error surfacing — no reactive caching, every call hits
/// the network directly, matching how [CatalogHomeScreen] already
/// refetches through `invalidateCatalog` after any admin mutation.
class CatalogRepository {
  CatalogRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1$path').replace(queryParameters: query);

  Future<RepositoryHttpResponse> _get(Uri url) =>
      _client.call(request: RepositoryHttpRequest(url: url));

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
      throw CatalogApiException.fromResponse(response);
    }
  }

  String _sortByParam(ComparisonSortColumn sortBy) => switch (sortBy) {
    ComparisonSortColumn.icms17 => 'icms17',
    ComparisonSortColumn.icms18 => 'icms18',
    ComparisonSortColumn.icms20 => 'icms20',
  };

  /// Every active AtlasMed product, grouped client-side by `productGroup`
  /// (falling back to the product's own name when it has none) into
  /// [CatalogFamily] entries. The catalog is small enough that a single
  /// generously-limited page covers the whole thing — there is no
  /// dedicated "all products" endpoint on the API.
  Future<List<CatalogFamily>> getFamilies() async {
    final response = await _get(
      _uri('/products', const {'limit': '500', 'isActive': 'true'}),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final variants = (decoded['data'] as List<dynamic>)
        .map((row) => CatalogVariant.fromJson(row as Map<String, dynamic>))
        .toList();
    return _groupIntoFamilies(variants);
  }

  List<CatalogFamily> _groupIntoFamilies(List<CatalogVariant> variants) {
    final byFamily = <String, List<CatalogVariant>>{};
    for (final variant in variants) {
      byFamily.putIfAbsent(variant.familyName, () => []).add(variant);
    }

    return byFamily.entries.map((entry) {
      final familyVariants = entry.value;
      final first = familyVariants.first;
      final publishedAt = familyVariants
          .map((v) => v.brasindiceUpdatedAt)
          .reduce((a, b) => a.isAfter(b) ? a : b);
      return CatalogFamily(
        id: first.id,
        name: entry.key,
        manufacturer: first.manufacturer,
        countryOfOrigin: first.countryOfOrigin,
        variants: familyVariants,
        brasindicePublishedAt: publishedAt,
        simproPublishedAt: publishedAt,
      );
    }).toList();
  }

  /// Returns the "Comparativo" for a single AtlasMed variant: the variant
  /// itself plus every competitor equivalence registered for it — scoped
  /// to exactly one product, distinct from [getFullPriceIndex].
  Future<ComparisonGroup> getComparison(
    int variantId, {
    ComparisonSortColumn sortBy = ComparisonSortColumn.icms20,
  }) async {
    final response = await _get(
      _uri('/products/$variantId/comparison', {'sortBy': _sortByParam(sortBy)}),
    );
    _throwIfError(response);
    return ComparisonGroup.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Returns the complete Tabela Brasíndice/Simpro: every AtlasMed variant
  /// and every competitor product in the catalog, flattened into a single
  /// sorted list — the full price index, not scoped to any one product.
  Future<List<ComparisonRow>> getFullPriceIndex({
    ComparisonSortColumn sortBy = ComparisonSortColumn.icms20,
  }) async {
    final response = await _get(
      _uri('/price-index', {'sortBy': _sortByParam(sortBy)}),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['data'] as List<dynamic>)
        .map((row) => ComparisonRow.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Every active commercial sector — backs the admin product form's
  /// sector picker.
  Future<List<CatalogBusinessVertical>> getVerticals() async {
    final response = await _get(
      _uri('/business-verticals', const {'limit': '100', 'isActive': 'true'}),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['data'] as List<dynamic>)
        .map(
          (row) =>
              CatalogBusinessVertical.fromJson(row as Map<String, dynamic>),
        )
        .toList();
  }

  // ── Admin mutations ──────────────────────────────────────────────────
  // Everything below is only reachable from admin-gated UI (see
  // `isAdminProvider`); the real API independently enforces the same
  // restriction via CASL (`create`/`update` on the `CATALOG` subject).

  /// Creates a new AtlasMed product variant via `POST /products`. Any
  /// `id` on [draft] is ignored — the server assigns it. [draft.presentation]
  /// has no dedicated column on the API, so it's folded into the name sent
  /// to the server (see [CatalogVariant.comparisonLabel]).
  Future<CatalogVariant> createVariant(CatalogVariant draft) async {
    final response = await _send(_uri('/products'), RepositoryHttpMethod.post, {
      'code': draft.code,
      'name': draft.comparisonLabel,
      'verticalIds': draft.verticalIds,
      'simproCode': draft.simproCode,
      'brasindiceCode': draft.brasindiceCode,
      'tissCode': draft.tissCode,
      'manufacturer': draft.manufacturer,
      'countryOfOrigin': draft.countryOfOrigin,
      'price': draft.price,
      'price17': draft.price17,
      'price18': draft.price18,
      'price20': draft.price20,
      'brasindiceUpdatedAt': _dateOnly(draft.brasindiceUpdatedAt),
    });
    _throwIfError(response);
    return CatalogVariant.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Updates an existing AtlasMed product variant via `PATCH /products/:id`.
  Future<CatalogVariant> updateVariant(CatalogVariant variant) async {
    final response = await _send(
      _uri('/products/${variant.id}'),
      RepositoryHttpMethod.patch,
      {
        'code': variant.code,
        'name': variant.comparisonLabel,
        'verticalIds': variant.verticalIds,
        'simproCode': variant.simproCode,
        'brasindiceCode': variant.brasindiceCode,
        'tissCode': variant.tissCode,
        'manufacturer': variant.manufacturer,
        'countryOfOrigin': variant.countryOfOrigin,
        'price': variant.price,
        'price17': variant.price17,
        'price18': variant.price18,
        'price20': variant.price20,
        'brasindiceUpdatedAt': _dateOnly(variant.brasindiceUpdatedAt),
      },
    );
    _throwIfError(response);
    return CatalogVariant.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Every competitor product in the catalog, regardless of whether it's
  /// linked to any AtlasMed variant yet — backs the admin "gerenciar
  /// outras marcas" picker.
  Future<List<CompetitorProduct>> getAllCompetitorProducts() async {
    final response = await _get(
      _uri('/competitor-products', const {'limit': '500', 'isActive': 'true'}),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['data'] as List<dynamic>)
        .map((row) => CompetitorProduct.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Creates a new competitor product, not yet linked to any AtlasMed
  /// variant, via `POST /competitor-products`. Any `id` on [draft] is
  /// ignored.
  Future<CompetitorProduct> createCompetitorProduct(
    CompetitorProduct draft,
  ) async {
    final response =
        await _send(_uri('/competitor-products'), RepositoryHttpMethod.post, {
          'name': draft.name,
          'manufacturer': draft.manufacturer,
          'brand': draft.brand,
          'countryOfOrigin': draft.countryOfOrigin,
          'price17': draft.price17,
          'price18': draft.price18,
          'price20': draft.price20,
          'brasindiceUpdatedAt': _dateOnly(draft.brasindiceUpdatedAt),
        });
    _throwIfError(response);
    return CompetitorProduct.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Updates an existing competitor product via
  /// `PATCH /competitor-products/:id`.
  Future<CompetitorProduct> updateCompetitorProduct(
    CompetitorProduct competitor,
  ) async {
    final response = await _send(
      _uri('/competitor-products/${competitor.id}'),
      RepositoryHttpMethod.patch,
      {
        'name': competitor.name,
        'manufacturer': competitor.manufacturer,
        'brand': competitor.brand,
        'countryOfOrigin': competitor.countryOfOrigin,
        'price17': competitor.price17,
        'price18': competitor.price18,
        'price20': competitor.price20,
        'brasindiceUpdatedAt': _dateOnly(competitor.brasindiceUpdatedAt),
      },
    );
    _throwIfError(response);
    return CompetitorProduct.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Competitor products not yet linked to [variantId] — backs the "add
  /// existing competitor" step of the picker.
  Future<List<CompetitorProduct>> getUnlinkedCompetitors(int variantId) async {
    final response = await _get(
      _uri('/products/$variantId/competitors/unlinked'),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['data'] as List<dynamic>)
        .map((row) => CompetitorProduct.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// Adds [competitorId] to [variantId]'s equivalence set via
  /// `POST /products/:variantId/competitors`.
  Future<void> linkCompetitor(int variantId, int competitorId) async {
    final response = await _send(
      _uri('/products/$variantId/competitors'),
      RepositoryHttpMethod.post,
      {'competitorProductId': competitorId},
    );
    _throwIfError(response);
  }

  /// Removes [competitorId] from [variantId]'s equivalence set via
  /// `DELETE /products/:variantId/competitors/:competitorId`. The
  /// competitor product itself still exists and can be relinked.
  Future<void> unlinkCompetitor(int variantId, int competitorId) async {
    final response = await _send(
      _uri('/products/$variantId/competitors/$competitorId'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  /// Formats [date] as `YYYY-MM-DD` — the API's `brasindiceUpdatedAt`
  /// column is a plain SQL `date`, not a timestamp.
  String _dateOnly(DateTime date) => date.toIso8601String().split('T').first;
}

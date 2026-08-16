import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_business_vertical.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/conformity_requirement.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/healthcare_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/support_catalog.dart';
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
/// the network directly, matching how [AdminProductsScreen] already
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
  Future<List<CatalogFamily>> getFamilies({bool includeInactive = false}) async {
    final response = await _get(
      _uri('/products', {
        'limit': '500',
        // Omitted entirely means "both" on the API. The rep-facing list keeps
        // asking for active only; the admin list asks for both (spec 0016 §4).
        if (!includeInactive) 'isActive': 'true',
      }),
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
      final publishedAt = _latestDate(
        familyVariants.map((v) => v.brasindiceUpdatedAt),
      );
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

  /// Latest non-null date, or `null` when every variant ships without one
  /// (no Brasíndice record yet).
  DateTime? _latestDate(Iterable<DateTime?> dates) {
    DateTime? latest;
    for (final date in dates) {
      if (date != null && (latest == null || date.isAfter(latest))) {
        latest = date;
      }
    }
    return latest;
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
      ...productRequestBody(draft),
      // Create-only, and required: a product with no Linha is invisible to
      // every rep and counts toward no metric (spec 0016 §7.2).
      'verticalIds': draft.verticalIds,
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
      productRequestBody(variant),
    );
    _throwIfError(response);
    return CatalogVariant.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  // ── Requisitos de cadastro (spec 0016 §4.7) ──────────────────────────
  // The catalogue the cadastro pipeline reads. The list is `read FACILITY`
  // because a rep needs the checklist; the writes are `CATALOG`, ADMIN only.

  Future<List<ConformityRequirement>> getConformityRequirements({
    bool includeInactive = false,
  }) async {
    final response = await _get(
      _uri('/conformity/requirements', {
        if (includeInactive) 'includeInactive': 'true',
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map(
          (row) =>
              ConformityRequirement.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  /// The body both writes send. `slug` is create-only — it is the key every
  /// cadastro DTO travels under, so `PATCH` rejects it.
  Map<String, dynamic> _requirementBody(ConformityRequirement requirement) => {
    'name': requirement.name,
    'description': requirement.description,
    'verticalId': requirement.verticalId,
    'appliesToLegalDocumentType': requirement.appliesToLegalDocumentType?.wire,
    'isActive': requirement.isActive,
    'allowedMimeTypes': requirement.allowedMimeTypes,
    'maxFiles': requirement.maxFiles,
    'maxFileSizeBytes': requirement.maxFileSizeBytes,
    'maxCombinedSizeBytes': requirement.maxCombinedSizeBytes,
    'requiresFrontAndBack': requirement.requiresFrontAndBack,
    'requiresValidityDate': requirement.requiresValidityDate,
  };

  Future<ConformityRequirement> createConformityRequirement(
    ConformityRequirement draft, {
    String? slug,
  }) async {
    final response = await _send(
      _uri('/conformity/requirements'),
      RepositoryHttpMethod.post,
      {
        ..._requirementBody(draft),
        // Omitted means the API derives it from the name.
        if (_nullIfBlank(slug) != null) 'slug': _nullIfBlank(slug),
      },
    );
    _throwIfError(response);
    return ConformityRequirement.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<ConformityRequirement> updateConformityRequirement(
    ConformityRequirement requirement,
  ) async {
    final response = await _send(
      _uri('/conformity/requirements/${requirement.id}'),
      RepositoryHttpMethod.patch,
      _requirementBody(requirement),
    );
    _throwIfError(response);
    return ConformityRequirement.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Answers 409 `RESOURCE_IN_USE` when a clinic has already answered it.
  Future<void> deleteConformityRequirement(int id) async {
    final response = await _send(
      _uri('/conformity/requirements/$id'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  // ── Catálogos de apoio (spec 0016 §4.6) ──────────────────────────────
  // Same three verbs against three endpoints that differ only in their path and
  // their second field, so one set of methods rather than nine.

  Future<List<SupportCatalogEntry>> getSupportCatalog(
    SupportCatalog catalog, {
    bool includeInactive = false,
  }) async {
    final response = await _get(
      _uri('/${catalog.path}', {
        // The pickers elsewhere in the app keep asking for active only, because
        // they omit this parameter entirely.
        if (includeInactive) 'includeInactive': 'true',
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map(
          (row) => SupportCatalogEntry.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  Future<SupportCatalogEntry> createSupportCatalogEntry(
    SupportCatalog catalog, {
    required String name,
    String? extra,
    bool isActive = true,
  }) async {
    final response = await _send(
      _uri('/${catalog.path}'),
      RepositoryHttpMethod.post,
      {
        'name': name,
        'isActive': isActive,
        if (catalog.extraLabel != null) 'extra': _nullIfBlank(extra),
      },
    );
    _throwIfError(response);
    return SupportCatalogEntry.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<SupportCatalogEntry> updateSupportCatalogEntry(
    SupportCatalog catalog, {
    required int id,
    required String name,
    String? extra,
    required bool isActive,
  }) async {
    final response = await _send(
      _uri('/${catalog.path}/$id'),
      RepositoryHttpMethod.patch,
      {
        'name': name,
        'isActive': isActive,
        if (catalog.extraLabel != null) 'extra': _nullIfBlank(extra),
      },
    );
    _throwIfError(response);
    return SupportCatalogEntry.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  // ── Fontes pagadoras (spec 0016 §4.5) ────────────────────────────────
  // The list is `read FACILITY` because a rep needs the picker when editing a
  // clinic's payer mix; the writes are `create`/`update CATALOG`, which only an
  // ADMIN holds. Same asymmetry the API documents on the route itself.

  /// Every fonte pagadora. [includeInactive] omits the filter, which the API
  /// reads as "both" — the admin list asks for both (spec 0016 §4).
  Future<List<HealthcareProvider>> getHealthcareProviders({
    bool includeInactive = false,
  }) async {
    final response = await _get(
      _uri('/healthcare-providers', {
        'limit': '200',
        if (!includeInactive) 'isActive': 'true',
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['data'] as List<dynamic>)
        .map((row) => HealthcareProvider.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  Future<HealthcareProvider> createHealthcareProvider({
    required String name,
    required HealthcareProviderType type,
    required bool isActive,
  }) async {
    final response = await _send(
      _uri('/healthcare-providers'),
      RepositoryHttpMethod.post,
      {'name': name, 'type': type.wire, 'isActive': isActive},
    );
    _throwIfError(response);
    return HealthcareProvider.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<HealthcareProvider> updateHealthcareProvider(
    HealthcareProvider provider,
  ) async {
    final response = await _send(
      _uri('/healthcare-providers/${provider.id}'),
      RepositoryHttpMethod.patch,
      {
        'name': provider.name,
        'type': provider.type.wire,
        'isActive': provider.isActive,
      },
    );
    _throwIfError(response);
    return HealthcareProvider.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Whether a product can be hard-deleted, and what stops it (spec 0016 §6.2).
  ///
  /// Read from `GET /products/:id` so the trash button can be disabled with a
  /// reason instead of offered and then failing — a rule the admin can see
  /// beats a 409 they have to provoke. The delete itself still handles the
  /// refusal, because an order can land between the two calls.
  Future<ProductDeletability> getProductDeletability(int productId) async {
    final response = await _get(_uri('/products/$productId'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return ProductDeletability.fromJson(decoded);
  }

  Future<ProductDeletability> getCompetitorDeletability(int competitorId) async {
    final response = await _get(_uri('/competitor-products/$competitorId'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return ProductDeletability.fromJson(decoded);
  }

  /// Hard-deletes a product. Answers 409 `RESOURCE_IN_USE` — surfaced as a
  /// [CatalogApiException] carrying `blockedBy` — when anything references it.
  Future<void> deleteVariant(int productId) async {
    final response = await _send(
      _uri('/products/$productId'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  Future<void> deleteCompetitorProduct(int competitorId) async {
    final response = await _send(
      _uri('/competitor-products/$competitorId'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  /// Every competitor product in the catalog, regardless of whether it's
  /// linked to any AtlasMed variant yet — backs the admin "gerenciar
  /// outras marcas" picker and the `Administração › Concorrentes` list.
  ///
  /// [includeInactive] omits the `isActive` filter entirely, which the API
  /// reads as "both". The admin list asks for both (spec 0016 §4): the panel is
  /// the one place you go *because* something is inactive.
  Future<List<CompetitorProduct>> getAllCompetitorProducts({
    bool includeInactive = false,
  }) async {
    final response = await _get(
      _uri('/competitor-products', {
        'limit': '500',
        if (!includeInactive) 'isActive': 'true',
      }),
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
    final response = await _send(
      _uri('/competitor-products'),
      RepositoryHttpMethod.post,
      _withBrasindiceDate({
        'name': draft.name,
        'manufacturer': draft.manufacturer,
        'brand': draft.brand,
        'countryOfOrigin': draft.countryOfOrigin,
        'price17': draft.price17,
        'price18': draft.price18,
        'price20': draft.price20,
        'isActive': draft.isActive,
      }, draft.brasindiceUpdatedAt),
    );
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
      _withBrasindiceDate({
        'name': competitor.name,
        'manufacturer': competitor.manufacturer,
        'brand': competitor.brand,
        'countryOfOrigin': competitor.countryOfOrigin,
        'price17': competitor.price17,
        'price18': competitor.price18,
        'price20': competitor.price20,
        'isActive': competitor.isActive,
      }, competitor.brasindiceUpdatedAt),
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
  /// column is a plain SQL `date`, not a timestamp. `null` when the product
  /// has no Brasíndice record.
  String? _dateOnly(DateTime? date) => date?.toIso8601String().split('T').first;

  /// Adds `brasindiceUpdatedAt` to [body], omitting the key when the date is
  /// null. Competitor products only — no competitor row has a Brasíndice
  /// record, so there is nothing to clear; products go through
  /// [productRequestBody], which sends the key even when null.
  Map<String, dynamic> _withBrasindiceDate(
    Map<String, dynamic> body,
    DateTime? brasindiceUpdatedAt,
  ) {
    final date = _dateOnly(brasindiceUpdatedAt);
    if (date == null) return body;
    return {...body, 'brasindiceUpdatedAt': date};
  }
}

/// The columns both product writes send, in the shape the API expects.
///
/// Blank text becomes JSON `null`, not `""`. The coding columns are
/// partial-unique where not null (spec 0013 §2), so two products saved with an
/// empty SIMPRO field would collide on `""` while two saved with `null` do not
/// — and `""` is not a code anyone can look up.
///
/// Two fields are absent by decision:
/// - `verticalIds` — create-only, because a product's Linhas are immutable
///   after creation (spec 0016 §6.7) and `PATCH /products/:id` rejects them.
/// - `metricUnits` — informative, no writer anywhere (§7.1).
///
/// A top-level function rather than a private method so the contract can be
/// asserted without a live HTTP client; it is the one place three separate spec
/// rules are encoded together.
Map<String, dynamic> productRequestBody(CatalogVariant variant) => {
  'code': _nullIfBlank(variant.code),
  'name': variant.comparisonLabel,
  'productGroup': variant.productGroup,
  'description': variant.description,
  'brand': variant.brand,
  'unit': variant.unit,
  'barcode': variant.barcode,
  'ncm': variant.ncm,
  'anvisaRegistration': variant.anvisaRegistration,
  'commercialCode': variant.commercialCode,
  'internalClassification': variant.internalClassification,
  'productClassification': variant.productClassification,
  'requiresSterilization': variant.requiresSterilization,
  'idProdutoEmultec': variant.idProdutoEmultec,
  'simproCode': _nullIfBlank(variant.simproCode),
  'brasindiceCode': _nullIfBlank(variant.brasindiceCode),
  'tissCode': _nullIfBlank(variant.tissCode),
  'manufacturer': variant.manufacturer,
  'countryOfOrigin': variant.countryOfOrigin,
  'price': variant.price,
  'price17': variant.price17,
  'price18': variant.price18,
  'price20': variant.price20,
  // Sent even when null: the route accepts `Nullable`, so this is how a
  // Brasíndice date is cleared along with the code it belongs to.
  'brasindiceUpdatedAt': _dateOnlyIso(variant.brasindiceUpdatedAt),
  'isActive': variant.isActive,
};

/// `YYYY-MM-DD` — `brasindice_updated_at` is a SQL `date`, not a timestamp.
String? _dateOnlyIso(DateTime? date) =>
    date?.toIso8601String().split('T').first;

/// Empty text is absence, not a value. See [productRequestBody].
String? _nullIfBlank(String? value) {
  final text = value?.trim();
  return (text == null || text.isEmpty) ? null : text;
}

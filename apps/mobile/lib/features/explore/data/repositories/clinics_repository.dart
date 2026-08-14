import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

/// Radius chip options for Explorar clinics (km). Clear = no `radiusKm`.
const List<double> exploreRadiusKmOptions = [5, 10, 25, 50, 100];

class ClinicsRepository extends Repository<PaginatedFacilities>
    with SessionEnvironmentMixin<PaginatedFacilities> {
  ClinicsRepository({
    String? baseUrl,
    String? cacheTag,
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.commercialStatus,
    this.purchaseBucket,
    this.productIds,
    this.clinicalFocusIds,
    this.unitTypeIds,
    this.legalDocumentType,
    this.cpfStatus,
    this.purchaseFunnelStages = const [],
    this.purchaseProfile,
    this.purchaseIntervalMinDays,
    this.purchaseIntervalMaxDays,
    this.sort,
    this.order,
    this.verticalId,
  }) : super(
         // Built through [makeEndpoint] rather than inline: the two used to be
         // parallel copies of the same query map, so a test asserting on
         // makeEndpoint said nothing about the URL the app actually requests.
         endpoint: makeEndpoint(
           baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
           page: page,
           limit: limit,
           searchQuery: searchQuery,
           latitude: latitude,
           longitude: longitude,
           radiusKm: radiusKm,
           commercialStatus: commercialStatus,
           purchaseBucket: purchaseBucket,
           productIds: productIds,
           clinicalFocusIds: clinicalFocusIds,
           unitTypeIds: unitTypeIds,
           legalDocumentType: legalDocumentType,
           cpfStatus: cpfStatus,
           purchaseFunnelStages: purchaseFunnelStages,
           purchaseProfile: purchaseProfile,
           purchaseIntervalMinDays: purchaseIntervalMinDays,
           purchaseIntervalMaxDays: purchaseIntervalMaxDays,
           sort: sort,
           order: order,
           verticalId: verticalId,
         ),
         name: 'ClinicsRepository',
         tag: cacheTag,
       );

  final int page;
  final int limit;
  final String? searchQuery;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? commercialStatus;
  final String? purchaseBucket;
  final String? productIds;
  final String? clinicalFocusIds;
  final String? unitTypeIds;
  final String? legalDocumentType;
  final String? cpfStatus;
  final List<PurchaseFunnelStage> purchaseFunnelStages;
  final PurchaseProfile? purchaseProfile;
  final int? purchaseIntervalMinDays;
  final int? purchaseIntervalMaxDays;
  final FacilitySort? sort;
  final SortOrder? order;
  final int? verticalId;

  /// Build the endpoint URI for this repository.
  /// Calls the shared [buildEndpoint] from [query_builder.dart].
  static Uri makeEndpoint({
    required String baseUrl,
    required int page,
    required int limit,
    String? searchQuery,
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? commercialStatus,
    String? purchaseBucket,
    String? productIds,
    String? clinicalFocusIds,
    String? unitTypeIds,
    String? legalDocumentType,
    String? cpfStatus,
    List<PurchaseFunnelStage> purchaseFunnelStages = const [],
    PurchaseProfile? purchaseProfile,
    int? purchaseIntervalMinDays,
    int? purchaseIntervalMaxDays,
    FacilitySort? sort,
    SortOrder? order,
    int? verticalId,
  }) {
    return buildEndpoint(
      baseUrl: baseUrl,
      path: '/api/v1/facilities',
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
        if (searchQuery != null && searchQuery.trim().isNotEmpty)
          'search': searchQuery.trim(),
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
        if (radiusKm != null) 'radiusKm': radiusKm.toString(),
        if (commercialStatus != null && commercialStatus.trim().isNotEmpty)
          'commercialStatus': commercialStatus.trim(),
        if (purchaseBucket != null && purchaseBucket.trim().isNotEmpty)
          'purchaseBucket': purchaseBucket.trim(),
        if (productIds != null && productIds.trim().isNotEmpty)
          'productIds': productIds.trim(),
        if (clinicalFocusIds != null && clinicalFocusIds.trim().isNotEmpty)
          'clinicalFocusIds': clinicalFocusIds.trim(),
        if (unitTypeIds != null && unitTypeIds.trim().isNotEmpty)
          'unitTypeIds': unitTypeIds.trim(),
        if (legalDocumentType != null && legalDocumentType.trim().isNotEmpty)
          'legalDocumentType': legalDocumentType.trim(),
        if (cpfStatus != null && cpfStatus.trim().isNotEmpty)
          'cpfStatus': cpfStatus.trim(),
        if (purchaseFunnelStages.isNotEmpty)
          'purchaseFunnelStage': purchaseFunnelStages
              .map((stage) => stage.apiValue)
              .join(','),
        if (purchaseProfile != null)
          'purchaseProfile': purchaseProfile.apiValue,
        if (purchaseIntervalMinDays != null)
          'purchaseIntervalMinDays': purchaseIntervalMinDays.toString(),
        if (purchaseIntervalMaxDays != null)
          'purchaseIntervalMaxDays': purchaseIntervalMaxDays.toString(),
        if (verticalId != null && verticalId > 0)
          'verticalId': verticalId.toString(),
        if (sort != null) 'sort': sort.apiValue,
        if (order != null) 'order': order.name,
      },
    );
  }

  @override
  PaginatedFacilities fromJson(String json) =>
      PaginatedFacilities.fromJson(json);
}

/// Sends the typed recurrence command through the existing authenticated
/// repository transport. It is separate from paginated listing because PATCH
/// returns one facility DTO.
class FacilityPurchaseRecurrenceRepository extends Repository<FacilityDTO>
    with SessionEnvironmentMixin<FacilityDTO> {
  FacilityPurchaseRecurrenceRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities',
        ),
        name: 'FacilityPurchaseRecurrenceRepository',
      );

  final String _baseUrl;
  RepositoryHttpRequest? _pendingRequest;

  @override
  FacilityDTO fromJson(String json) => FacilityDTO.fromJson(json);

  RepositoryHttpRequest buildPatchRequest(
    int facilityId,
    PurchaseRecurrenceCommand command,
  ) => makePatchRequest(_baseUrl, facilityId, command);

  static RepositoryHttpRequest makePatchRequest(
    String baseUrl,
    int facilityId,
    PurchaseRecurrenceCommand command,
  ) {
    command.validate();
    return RepositoryHttpRequest(
      url: Uri.parse('$baseUrl/api/v1/facilities/$facilityId'),
      method: RepositoryHttpMethod.patch,
      headers: const {'Content-Type': 'application/json'},
      body: command.toJson(),
    );
  }

  Future<FacilityDTO> updatePurchaseRecurrence(
    int facilityId,
    PurchaseRecurrenceCommand command,
  ) async {
    _pendingRequest = buildPatchRequest(facilityId, command);
    try {
      final result = await refresh();
      if (result == null) {
        throw StateError('A atualização não retornou o estabelecimento.');
      }
      return result;
    } finally {
      _pendingRequest = null;
    }
  }

  @override
  Future<String?> resolve() async {
    final request = _pendingRequest;
    if (request == null) return null;
    final response = await client.call(request: request);
    if (successfulCondition(response.statusCode, response.body)) {
      return response.body;
    }
    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      throw UnexpectedStatusCodeException(sent: request, received: response);
    }
    return response.body;
  }
}

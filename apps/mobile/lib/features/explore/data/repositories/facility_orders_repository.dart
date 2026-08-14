import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityOrdersPage {
  const FacilityOrdersPage({
    required this.orders,
    this.page = 1,
    this.total = 0,
    this.totalPages = 1,
  });

  final List<FacilityOrderSummary> orders;
  final int page;

  /// Every order this clinic has, not the handful on this page. The section
  /// fetched five and its header badge counted the five it had, so a clinic
  /// with eighty orders advertised "5".
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory FacilityOrdersPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final list = data is List ? data : const [];
    final orders = list
        .whereType<Map>()
        .map((row) => _mapOrder(Map<String, dynamic>.from(row)))
        .toList(growable: false);
    final pagination = json['pagination'];
    if (pagination is! Map) {
      // Older payloads had no pagination block; one page of whatever arrived.
      return FacilityOrdersPage(orders: orders, total: orders.length);
    }
    return FacilityOrdersPage(
      orders: orders,
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      total: (pagination['total'] as num?)?.toInt() ?? orders.length,
      totalPages: (pagination['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

FacilityOrderSummary _mapOrder(Map<String, dynamic> json) {
  final idAvulsaEmultec = json['idAvulsaEmultec'];
  final id = readCrmId(json['id'], 'id');
  final itemsRaw = json['items'];
  final items = itemsRaw is List
      ? itemsRaw
            .whereType<Map>()
            .map((row) => _mapItem(Map<String, dynamic>.from(row)))
            .toList(growable: false)
      : const <FacilityOrderItemSummary>[];

  return FacilityOrderSummary(
    id: id,
    displayId: idAvulsaEmultec == null ? id.toString() : 'PED-$idAvulsaEmultec',
    status: (json['status'] as String?) ?? 'PENDING',
    type: (json['type'] as String?) ?? 'SALE',
    orderedAt:
        _dateOrNull(json['orderedAt']) ??
        _dateOrNull(json['createdAt']) ??
        DateTime.fromMillisecondsSinceEpoch(0),
    total: _number(json['total']),
    itemCount: (json['itemCount'] as num?)?.toInt() ?? items.length,
    items: items,
  );
}

FacilityOrderItemSummary _mapItem(Map<String, dynamic> json) {
  return FacilityOrderItemSummary(
    productName: (json['productName'] as String?)?.trim().isNotEmpty == true
        ? json['productName'] as String
        : ((json['product'] as Map?)?['name'] as String?) ?? 'Produto',
    quantity: _number(json['quantity']),
    unitPrice: _number(json['unitPrice']),
  );
}

DateTime? _dateOrNull(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

double _number(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

/// `GET /facilities/:id/orders` — recent facility-scoped orders with item previews.
class FacilityOrdersRepository extends Repository<FacilityOrdersPage>
    with SessionEnvironmentMixin<FacilityOrdersPage> {
  FacilityOrdersRepository({
    required this.facilityId,
    this.page = 1,
    this.limit = 5,
    this.verticalId,
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _injectedClient = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/orders'
           '?page=$page&limit=$limit'
           '${verticalId != null && (verticalId > 0) ? '&verticalId=$verticalId' : ''}',
         ),
         name: 'FacilityOrdersRepository',
       );

  final int facilityId;
  final int page;
  final int limit;
  final int? verticalId;
  final RepositoryHttpClient? _injectedClient;

  @override
  RepositoryHttpClient get client => _injectedClient ?? super.client;

  @override
  FacilityOrdersPage fromJson(String json) =>
      FacilityOrdersPage.fromJson(jsonDecode(json) as Map<String, dynamic>);

  Future<List<FacilityOrderSummary>> loadOrders() async {
    final pageData = await currentValueOrResolve();
    return pageData?.orders ?? const [];
  }

  /// The page with its counts, for callers that need to know more exists.
  /// [loadOrders] stays for the call sites that only want the rows.
  Future<FacilityOrdersPage> loadPage() async {
    return await currentValueOrResolve() ??
        const FacilityOrdersPage(orders: []);
  }
}

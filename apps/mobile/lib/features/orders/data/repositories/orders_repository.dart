import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ApiOrderIdentity {
  const ApiOrderIdentity({required this.id, required this.name});

  final int id;
  final String name;

  factory ApiOrderIdentity.fromJson(Map<String, dynamic> json) =>
      ApiOrderIdentity(id: readCrmId(json['id'], 'id'), name: json['name'] as String);
}

class ApiOrderListItem {
  const ApiOrderListItem({
    required this.id,
    required this.idAvulsaEmultec,
    required this.verticalId,
    required this.status,
    required this.type,
    required this.orderedAt,
    required this.createdAt,
    required this.facility,
    required this.professional,
    required this.seller,
    required this.itemCount,
    required this.itemsTotal,
    required this.freight,
    required this.total,
  });

  final int id;
  final int? idAvulsaEmultec;
  final int? verticalId;
  final String status;
  final String type;
  final DateTime? orderedAt;
  final DateTime createdAt;
  final ApiOrderIdentity facility;
  final ApiOrderIdentity? professional;
  final ApiOrderIdentity? seller;
  final int itemCount;
  final double itemsTotal;
  final double freight;
  final double total;

  String get displayId => idAvulsaEmultec == null ? id.toString() : 'PED-$idAvulsaEmultec';

  factory ApiOrderListItem.fromJson(Map<String, dynamic> json) =>
      ApiOrderListItem(
        id: readCrmId(json['id'], 'id'),
        idAvulsaEmultec: json['idAvulsaEmultec'] as int?,
        verticalId: readCrmIdOrNull(json['verticalId'], 'verticalId'),
        status: json['status'] as String,
        type: json['type'] as String,
        orderedAt: _dateOrNull(json['orderedAt']),
        createdAt: DateTime.parse(json['createdAt'] as String),
        facility: ApiOrderIdentity.fromJson(
          json['facility'] as Map<String, dynamic>,
        ),
        professional: _identityOrNull(json['professional']),
        seller: _identityOrNull(json['seller']),
        itemCount: json['itemCount'] as int,
        itemsTotal: _number(json['itemsTotal']),
        freight: _number(json['freight']),
        total: _number(json['total']),
      );
}

class CreateOrderItemInput {
  const CreateOrderItemInput({
    required this.productId,
    required this.quantity,
    this.unitPrice,
  });

  final int productId;
  final double quantity;
  final double? unitPrice;

  Map<String, dynamic> toJson() => {
    'productId': productId,
    'quantity': quantity,
    if (unitPrice != null) 'unitPrice': unitPrice,
  };
}

class ApiOrderItem {
  const ApiOrderItem({
    required this.id,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
    required this.writtenOff,
    required this.product,
  });

  final int id;
  final double quantity;
  final double unitPrice;
  final double lineTotal;
  final bool writtenOff;
  final ApiOrderProduct? product;

  factory ApiOrderItem.fromJson(Map<String, dynamic> json) => ApiOrderItem(
    id: readCrmId(json['id'], 'id'),
    quantity: _number(json['quantity']),
    unitPrice: _number(json['unitPrice']),
    lineTotal: _number(json['lineTotal']),
    writtenOff: json['writtenOff'] as bool? ?? false,
    product: json['product'] == null
        ? null
        : ApiOrderProduct.fromJson(json['product'] as Map<String, dynamic>),
  );
}

class ApiOrderProduct {
  const ApiOrderProduct({
    required this.id,
    required this.name,
    required this.code,
  });
  final int id;
  final String name;
  final String code;
  factory ApiOrderProduct.fromJson(Map<String, dynamic> json) =>
      ApiOrderProduct(
        id: readCrmId(json['id'], 'id'),
        name: json['name'] as String,
        code: json['code'] as String,
      );
}

class ApiOrderDetail extends ApiOrderListItem {
  const ApiOrderDetail({
    required super.id,
    required super.idAvulsaEmultec,
    required super.verticalId,
    required super.status,
    required super.type,
    required super.orderedAt,
    required super.createdAt,
    required super.facility,
    required super.professional,
    required super.seller,
    required super.itemCount,
    required super.itemsTotal,
    required super.freight,
    required super.total,
    required this.updatedAt,
    required this.currency,
    required this.notes,
    required this.items,
  });

  final DateTime updatedAt;
  final String currency;
  final String? notes;
  final List<ApiOrderItem> items;

  factory ApiOrderDetail.fromJson(Map<String, dynamic> json) => ApiOrderDetail(
    id: readCrmId(json['id'], 'id'),
    idAvulsaEmultec: json['idAvulsaEmultec'] as int?,
    verticalId: readCrmIdOrNull(json['verticalId'], 'verticalId'),
    status: json['status'] as String,
    type: json['type'] as String,
    orderedAt: _dateOrNull(json['orderedAt']),
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    facility: ApiOrderIdentity.fromJson(
      json['facility'] as Map<String, dynamic>,
    ),
    professional: _identityOrNull(json['professional']),
    seller: _identityOrNull(json['seller']),
    itemCount: json['itemCount'] as int? ?? (json['items'] as List).length,
    itemsTotal: _number(json['itemsTotal']),
    freight: _number(json['freight']),
    total: _number(json['total']),
    currency: json['currency'] as String? ?? 'BRL',
    notes: json['notes'] as String?,
    items: (json['items'] as List<dynamic>? ?? const [])
        .map((item) => ApiOrderItem.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
  );
}

class OrdersPage {
  const OrdersPage({
    required this.data,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });
  final List<ApiOrderListItem> data;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory OrdersPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>;
    return OrdersPage(
      data: (json['data'] as List<dynamic>)
          .map(
            (order) => ApiOrderListItem.fromJson(order as Map<String, dynamic>),
          )
          .toList(growable: false),
      page: pagination['page'] as int,
      limit: pagination['limit'] as int,
      total: pagination['total'] as int,
      totalPages: pagination['totalPages'] as int,
    );
  }
}

class OrdersRepository extends Repository<OrdersPage>
    with SessionEnvironmentMixin<OrdersPage> {
  OrdersRepository({required String baseUrl, RepositoryHttpClient? client})
    : _baseUri = Uri.parse(baseUrl),
      _injectedClient = client,
      super(
        endpoint: Uri.parse('$baseUrl/api/v1/orders'),
        resolveOnCreate: false,
        name: 'OrdersRepository',
      );

  final Uri _baseUri;
  final RepositoryHttpClient? _injectedClient;

  @override
  RepositoryHttpClient get client => _injectedClient ?? super.client;

  @override
  OrdersPage fromJson(String json) =>
      OrdersPage.fromJson(jsonDecode(json) as Map<String, dynamic>);

  Future<OrdersPage> listOrders({
    int page = 1,
    int limit = 20,
    List<String>? statuses,
  }) async {
    final query = <String, String>{'page': '$page', 'limit': '$limit'};
    if (statuses != null && statuses.isNotEmpty) {
      query['status'] = statuses.join(',');
    }
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/orders', queryParameters: query),
      ),
    );
    if (response.statusCode != 200) {
      throw StateError('Não foi possível carregar os pedidos.');
    }
    return OrdersPage.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<ApiOrderDetail> getOrder(int id) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/orders/$id'),
      ),
    );
    if (response.statusCode != 200) {
      throw StateError('Não foi possível carregar o pedido.');
    }
    return ApiOrderDetail.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<ApiOrderDetail> createOrder({
    required int facilityId,
    required List<CreateOrderItemInput> items,
    int? verticalId,
    int? personId,
    String? notes,
    double? freight,
    String? idempotencyKey,
    int? interactionId,
  }) async {
    final headers = <String, String>{
      if (idempotencyKey != null && idempotencyKey.isNotEmpty)
        'Idempotency-Key': idempotencyKey,
    };
    // [interactionId] accepted for checkout call-site alignment; create-order
    // body schema does not include it yet (would 422 if sent).
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/orders'),
        method: RepositoryHttpMethod.post,
        headers: headers,
        // ignore_for_file: use_null_aware_elements — value-nullable map entries, not key-nullable.
        body: {
          'facilityId': facilityId,
          if (verticalId != null) 'verticalId': verticalId,
          if (personId != null) 'personId': personId,
          if (notes != null) 'notes': notes,
          if (freight != null) 'freight': freight,
          'items': items.map((item) => item.toJson()).toList(growable: false),
        },
      ),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw StateError('Não foi possível criar o pedido.');
    }
    return ApiOrderDetail.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }
}

DateTime? _dateOrNull(dynamic value) =>
    value == null ? null : DateTime.parse(value as String);
ApiOrderIdentity? _identityOrNull(dynamic value) => value == null
    ? null
    : ApiOrderIdentity.fromJson(value as Map<String, dynamic>);
double _number(dynamic value) => (value as num).toDouble();

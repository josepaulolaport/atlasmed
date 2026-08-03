import 'dart:convert';

import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ApiOrderIdentity {
  const ApiOrderIdentity({required this.id, required this.name});

  final String id;
  final String name;

  factory ApiOrderIdentity.fromJson(Map<String, dynamic> json) =>
      ApiOrderIdentity(id: json['id'] as String, name: json['name'] as String);
}

class ApiOrderListItem {
  const ApiOrderListItem({
    required this.id,
    required this.legacyId,
    required this.verticalId,
    required this.interactionId,
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

  final String id;
  final int? legacyId;
  final String? verticalId;
  final String? interactionId;
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

  String get displayId => legacyId == null ? id : 'PED-$legacyId';

  factory ApiOrderListItem.fromJson(Map<String, dynamic> json) =>
      ApiOrderListItem(
        id: json['id'] as String,
        legacyId: json['legacyId'] as int?,
        verticalId: json['verticalId'] as String?,
        interactionId: json['interactionId'] as String?,
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

  final String productId;
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

  final String id;
  final double quantity;
  final double unitPrice;
  final double lineTotal;
  final bool writtenOff;
  final ApiOrderProduct? product;

  factory ApiOrderItem.fromJson(Map<String, dynamic> json) => ApiOrderItem(
    id: json['id'] as String,
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
  final String id;
  final String name;
  final String code;
  factory ApiOrderProduct.fromJson(Map<String, dynamic> json) =>
      ApiOrderProduct(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
      );
}

class ApiOrderDetail extends ApiOrderListItem {
  const ApiOrderDetail({
    required super.id,
    required super.legacyId,
    required super.verticalId,
    required super.interactionId,
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
    id: json['id'] as String,
    legacyId: json['legacyId'] as int?,
    verticalId: json['verticalId'] as String?,
    interactionId: json['interactionId'] as String?,
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
    String? interactionId,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (interactionId != null && interactionId.isNotEmpty)
        'interactionId': interactionId,
    };
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

  Future<ApiOrderDetail> getOrder(String id) async {
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
    required String facilityId,
    required List<CreateOrderItemInput> items,
    String? interactionId,
    String? verticalId,
    String? professionalId,
    String? notes,
    double? freight,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: _baseUri.replace(path: '/api/v1/orders'),
        method: RepositoryHttpMethod.post,
        body: {
          'facilityId': facilityId,
          'interactionId': ?interactionId,
          'verticalId': ?verticalId,
          'professionalId': ?professionalId,
          'notes': ?notes,
          'freight': ?freight,
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

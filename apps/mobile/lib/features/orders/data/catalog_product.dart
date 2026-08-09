import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

class CatalogProduct {
  const CatalogProduct({
    required this.id,
    required this.code,
    required this.name,
    required this.description,
    required this.commercialCode,
    required this.productGroup,
    required this.productClassification,
    required this.brand,
    required this.unit,
    required this.pictureUrl,
    required this.price,
    required this.price17,
    required this.price18,
    required this.price20,
    required this.isActive,
  });

  final int id;
  final String code;
  final String name;
  final String? description;
  final String? commercialCode;
  final String? productGroup;
  final String? productClassification;
  final String? brand;
  final String? unit;
  final String? pictureUrl;
  final double price;
  final double price17;
  final double price18;
  final double price20;
  final bool isActive;

  String get subtitle {
    final parts = [
      if (description?.trim().isNotEmpty ?? false) description!.trim(),
      if (unit?.trim().isNotEmpty ?? false) unit!.trim(),
    ];
    return parts.isNotEmpty ? parts.join(' · ') : code;
  }

  String get category => productGroup?.trim().isNotEmpty ?? false
      ? productGroup!.trim()
      : 'Outros';

  factory CatalogProduct.fromJson(Map<String, dynamic> json) {
    double readPrice(Object? value) => switch (value) {
      num value => value.toDouble(),
      String value => double.tryParse(value) ?? 0,
      _ => 0,
    };

    String? readOptionalString(Object? value) =>
        value is String && value.isNotEmpty ? value : null;

    return CatalogProduct(
      id: readCrmId(json['id'], 'id'),
      code: json['code'] as String,
      name: json['name'] as String,
      description: readOptionalString(json['description']),
      commercialCode: readOptionalString(json['commercialCode']),
      productGroup: readOptionalString(json['productGroup']),
      productClassification: readOptionalString(json['productClassification']),
      brand: readOptionalString(json['brand']),
      unit: readOptionalString(json['unit']),
      pictureUrl: readOptionalString(json['pictureUrl']),
      price: readPrice(json['price']),
      price17: readPrice(json['price17']),
      price18: readPrice(json['price18']),
      price20: readPrice(json['price20']),
      isActive: json['isActive'] as bool? ?? false,
    );
  }
}

class CatalogProductPage {
  const CatalogProductPage({
    required this.products,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<CatalogProduct> products;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory CatalogProductPage.fromJson(Map<String, dynamic> json) {
    final pagination = json['pagination'] as Map<String, dynamic>;
    return CatalogProductPage(
      products: (json['data'] as List<dynamic>)
          .map((item) => CatalogProduct.fromJson(item as Map<String, dynamic>))
          .toList(),
      page: pagination['page'] as int,
      limit: pagination['limit'] as int,
      total: pagination['total'] as int,
      totalPages: pagination['totalPages'] as int,
    );
  }
}

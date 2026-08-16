import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// A single sellable presentation of an AtlasMed product (mirrors a row of
/// the `products` table: code, simpro/brasindice/tiss coding, ICMS pricing).
///
/// Several variants sharing the same [familyName] (`productGroup` in the DB)
/// are grouped into a [CatalogFamily] for display.
///
/// [code], [simproCode], [brasindiceCode], [tissCode] and
/// [brasindiceUpdatedAt] are nullable on the API (spec 0013 §2: the coding
/// columns are NULLABLE by correctness — e.g. a product whose Brasíndice
/// record has not been imported yet). They parse to `''` / `null` here, never
/// to a thrown cast, so one incomplete product cannot take down the whole
/// list.
class CatalogVariant {
  const CatalogVariant({
    required this.id,
    required this.code,
    required this.name,
    required this.familyName,
    required this.presentation,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.simproCode,
    required this.brasindiceCode,
    required this.tissCode,
    required this.price,
    required this.price17,
    required this.price18,
    required this.price20,
    required this.brasindiceUpdatedAt,
    this.isActive = true,
    this.verticalIds = const [],
    this.productGroup,
    this.description,
    this.brand,
    this.unit,
    this.barcode,
    this.ncm,
    this.anvisaRegistration,
    this.commercialCode,
    this.internalClassification,
    this.productClassification,
    this.requiresSterilization = false,
    this.idProdutoEmultec,
    this.metricUnits = 1,
    this.pictureUrl,
    this.pictureBlurhash,
  });

  final int id;
  final String code;
  final String name;
  final String familyName;

  /// e.g. "20MG / 2ML" — concentration/volume shown alongside the name.
  /// The real API has no dedicated column for this — it only ever comes
  /// back combined into [name] (see [comparisonLabel]) — so this is only
  /// ever non-empty for a variant still being edited locally in
  /// [VariantFormScreen], before it round-trips through the backend.
  final String presentation;
  final String manufacturer;
  final String countryOfOrigin;
  final String simproCode;
  final String brasindiceCode;
  final String tissCode;
  final double price;
  final double price17;
  final double price18;
  final double price20;

  /// Null when the product has no Brasíndice record yet (it ships with no
  /// [brasindiceCode]) — the API column is nullable.
  final DateTime? brasindiceUpdatedAt;
  final bool isActive;

  /// Commercial sectors this product belongs to (`verticalIds` on the
  /// `products` table).
  ///
  /// Chosen once, at creation, and immutable afterwards — spec 0016 §6.7. The
  /// API's `PATCH /products/:id` no longer accepts them.
  final List<int> verticalIds;

  /// The `product_group` column, which is what groups presentations into a
  /// family. Read straight from the API rather than derived, because the admin
  /// form edits it: [familyName] is the *display* fallback and cannot be sent
  /// back without renaming products that have no group.
  final String? productGroup;

  final String? description;
  final String? brand;
  final String? unit;
  final String? barcode;
  final String? ncm;
  final String? anvisaRegistration;
  final String? commercialCode;
  final String? internalClassification;
  final String? productClassification;
  final bool requiresSterilization;

  /// The Emultec product id — how the order importer matches a line to a
  /// product. Setting it is how an admin resolves a dead-lettered order
  /// (spec 0013 §5).
  final int? idProdutoEmultec;

  /// How many metric units one product unit represents.
  ///
  /// **Read-only** (spec 0016 §7.1). Shown on the detail screen and never
  /// editable: the metric calculation uses raw quantities since spec 0013 §4.6,
  /// and the API has no writer for this column.
  final double metricUnits;

  /// The product's picture, as a path this API serves
  /// (`/api/v1/products/pictures/...`), or null.
  ///
  /// **Not part of the save payload.** It is written by
  /// `POST`/`DELETE /products/:id/picture` and stripped from the product body,
  /// so an admin cannot point a product at an arbitrary URL and the blurhash
  /// beside it stays derived from the bytes rather than typed.
  final String? pictureUrl;

  /// Placeholder gradient for [pictureUrl], computed server-side on upload.
  final String? pictureBlurhash;

  /// Full label used inside comparison tables, e.g. "REVISCON 1.0% - 20MG / 2ML".
  String get comparisonLabel =>
      presentation.isEmpty ? name : '$name - $presentation';

  factory CatalogVariant.fromJson(Map<String, dynamic> json) {
    double readPrice(Object? value) => switch (value) {
      num v => v.toDouble(),
      String v => double.tryParse(v) ?? 0,
      _ => 0,
    };
    // Coding columns are nullable by design (spec 0013 §2) — the API sends
    // JSON null for a product without them, never a string.
    String readCode(Object? value) => (value as String?)?.trim() ?? '';
    String? readOptional(Object? value) {
      final text = (value as String?)?.trim();
      return (text == null || text.isEmpty) ? null : text;
    }

    final productGroup = readOptional(json['productGroup']);
    final name = json['name'] as String;

    return CatalogVariant(
      id: readCrmId(json['id'], 'id'),
      code: readCode(json['code']),
      name: name,
      familyName: productGroup ?? name,
      // Never populated separately by the real API — see [presentation].
      presentation: '',
      manufacturer: json['manufacturer'] as String,
      countryOfOrigin: json['countryOfOrigin'] as String,
      simproCode: readCode(json['simproCode']),
      brasindiceCode: readCode(json['brasindiceCode']),
      tissCode: readCode(json['tissCode']),
      price: readPrice(json['price']),
      price17: readPrice(json['price17']),
      price18: readPrice(json['price18']),
      price20: readPrice(json['price20']),
      brasindiceUpdatedAt: DateTime.tryParse(
        json['brasindiceUpdatedAt'] as String? ?? '',
      ),
      isActive: json['isActive'] as bool? ?? true,
      verticalIds: readCrmIdList(json['verticalIds'], 'verticalIds'),
      productGroup: productGroup,
      description: readOptional(json['description']),
      brand: readOptional(json['brand']),
      unit: readOptional(json['unit']),
      barcode: readOptional(json['barcode']),
      ncm: readOptional(json['ncm']),
      anvisaRegistration: readOptional(json['anvisaRegistration']),
      commercialCode: readOptional(json['commercialCode']),
      internalClassification: readOptional(json['internalClassification']),
      productClassification: readOptional(json['productClassification']),
      requiresSterilization: json['requiresSterilization'] as bool? ?? false,
      idProdutoEmultec: json['idProdutoEmultec'] == null
          ? null
          : readCrmId(json['idProdutoEmultec'], 'idProdutoEmultec'),
      metricUnits: readPrice(json['metricUnits'] ?? 1),
      pictureUrl: readOptional(json['pictureUrl']),
      pictureBlurhash: readOptional(json['pictureBlurhash']),
    );
  }

  /// Field-by-field copy.
  ///
  /// Every nullable field takes a `clear<Field>` companion, because `null`
  /// already means "leave it alone" in a `copyWith` and the admin form has to
  /// be able to *empty* a code — which is the whole point of spec 0013 §2
  /// making them nullable.
  CatalogVariant copyWith({
    int? id,
    String? code,
    String? name,
    String? familyName,
    String? presentation,
    String? manufacturer,
    String? countryOfOrigin,
    String? simproCode,
    String? brasindiceCode,
    String? tissCode,
    double? price,
    double? price17,
    double? price18,
    double? price20,
    DateTime? brasindiceUpdatedAt,
    bool clearBrasindiceUpdatedAt = false,
    bool? isActive,
    List<int>? verticalIds,
    String? productGroup,
    String? description,
    String? brand,
    String? unit,
    String? barcode,
    String? ncm,
    String? anvisaRegistration,
    String? commercialCode,
    String? internalClassification,
    String? productClassification,
    bool? requiresSterilization,
    int? idProdutoEmultec,
    bool clearIdProdutoEmultec = false,
    double? metricUnits,
    String? pictureUrl,
    String? pictureBlurhash,
    bool clearPicture = false,
  }) {
    return CatalogVariant(
      id: id ?? this.id,
      code: code ?? this.code,
      name: name ?? this.name,
      familyName: familyName ?? this.familyName,
      presentation: presentation ?? this.presentation,
      manufacturer: manufacturer ?? this.manufacturer,
      countryOfOrigin: countryOfOrigin ?? this.countryOfOrigin,
      simproCode: simproCode ?? this.simproCode,
      brasindiceCode: brasindiceCode ?? this.brasindiceCode,
      tissCode: tissCode ?? this.tissCode,
      price: price ?? this.price,
      price17: price17 ?? this.price17,
      price18: price18 ?? this.price18,
      price20: price20 ?? this.price20,
      brasindiceUpdatedAt: clearBrasindiceUpdatedAt
          ? null
          : brasindiceUpdatedAt ?? this.brasindiceUpdatedAt,
      isActive: isActive ?? this.isActive,
      verticalIds: verticalIds ?? this.verticalIds,
      productGroup: productGroup ?? this.productGroup,
      description: description ?? this.description,
      brand: brand ?? this.brand,
      unit: unit ?? this.unit,
      barcode: barcode ?? this.barcode,
      ncm: ncm ?? this.ncm,
      anvisaRegistration: anvisaRegistration ?? this.anvisaRegistration,
      commercialCode: commercialCode ?? this.commercialCode,
      internalClassification:
          internalClassification ?? this.internalClassification,
      productClassification:
          productClassification ?? this.productClassification,
      requiresSterilization:
          requiresSterilization ?? this.requiresSterilization,
      idProdutoEmultec: clearIdProdutoEmultec
          ? null
          : idProdutoEmultec ?? this.idProdutoEmultec,
      metricUnits: metricUnits ?? this.metricUnits,
      pictureUrl: clearPicture ? null : pictureUrl ?? this.pictureUrl,
      pictureBlurhash: clearPicture
          ? null
          : pictureBlurhash ?? this.pictureBlurhash,
    );
  }
}

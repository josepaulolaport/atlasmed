import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, dynamic> row({
    String? code = '4064544237823',
    String? simproCode = '0359465',
    String? brasindiceCode = '028063',
    String? tissCode = '0000092106',
    String? brasindiceUpdatedAt = '2025-07-14T00:00:00.000Z',
    String? productGroup,
  }) => {
    'id': 10,
    'code': code,
    'name': 'EVISC 1.0% - ARTIGO ORTOP PARA LUB E ABSOR DE CHOQUE DA ARTICULACAO',
    'productGroup': productGroup,
    'manufacturer': 'TRB PHARMA',
    'countryOfOrigin': 'Brasil',
    'simproCode': simproCode,
    'brasindiceCode': brasindiceCode,
    'tissCode': tissCode,
    'price': '2855.00',
    'price17': '2855.00',
    'price18': '2855.00',
    'price20': '2855.00',
    'brasindiceUpdatedAt': brasindiceUpdatedAt,
    'isActive': true,
    'verticalIds': [1],
  };

  test('parses a fully coded product', () {
    final variant = CatalogVariant.fromJson(row());

    expect(variant.id, 10);
    expect(variant.code, '4064544237823');
    expect(variant.simproCode, '0359465');
    expect(variant.brasindiceCode, '028063');
    expect(variant.tissCode, '0000092106');
    expect(variant.brasindiceUpdatedAt, DateTime.parse('2025-07-14T00:00:00.000Z'));
  });

  test('parses a product with null coding columns instead of throwing', () {
    // Mirrors the production row that broke the products screen: EVISC 1.0%
    // has simpro/brasindice/tiss codes and no date, all null (spec 0013 §2).
    final variant = CatalogVariant.fromJson(
      row(
        simproCode: null,
        brasindiceCode: null,
        tissCode: null,
        brasindiceUpdatedAt: null,
      ),
    );

    expect(variant.id, 10);
    expect(variant.code, '4064544237823');
    expect(variant.simproCode, '');
    expect(variant.brasindiceCode, '');
    expect(variant.tissCode, '');
    expect(variant.brasindiceUpdatedAt, isNull);
  });

  test('falls back to the product name when productGroup is null', () {
    final variant = CatalogVariant.fromJson(row(productGroup: null));

    expect(variant.familyName, variant.name);
  });
}

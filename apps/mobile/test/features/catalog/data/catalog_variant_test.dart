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
    'name':
        'EVISC 1.0% - ARTIGO ORTOP PARA LUB E ABSOR DE CHOQUE DA ARTICULACAO',
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
    expect(
      variant.brasindiceUpdatedAt,
      DateTime.parse('2025-07-14T00:00:00.000Z'),
    );
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
    // …but `productGroup` itself stays null, so a save cannot write the
    // fallback back as if it were a real family (spec 0016 §4.2).
    expect(variant.productGroup, isNull);
  });

  test('keeps productGroup distinct from the display fallback', () {
    final variant = CatalogVariant.fromJson(row(productGroup: 'EVISC'));

    expect(variant.productGroup, 'EVISC');
    expect(variant.familyName, 'EVISC');
  });

  test('metricUnits defaults to 1 and parses a numeric string', () {
    // Informative only (spec 0016 §7.1) — read, displayed, never written.
    expect(CatalogVariant.fromJson(row()).metricUnits, 1);
    expect(
      CatalogVariant.fromJson({...row(), 'metricUnits': '5.000'}).metricUnits,
      5,
    );
  });

  test('reads the admin columns spec 0016 §4.2 added to the form', () {
    final variant = CatalogVariant.fromJson({
      ...row(),
      'description': 'Gel viscoelástico',
      'brand': 'Evisc',
      'unit': 'caixa',
      'barcode': '7891234567890',
      'ncm': '3006.10.19',
      'anvisaRegistration': '80102510036',
      'commercialCode': 'EV-1',
      'internalClassification': 'A',
      'productClassification': 'Tópico',
      'requiresSterilization': true,
      'idProdutoEmultec': 4321,
    });

    expect(variant.description, 'Gel viscoelástico');
    expect(variant.brand, 'Evisc');
    expect(variant.unit, 'caixa');
    expect(variant.barcode, '7891234567890');
    expect(variant.ncm, '3006.10.19');
    expect(variant.anvisaRegistration, '80102510036');
    expect(variant.commercialCode, 'EV-1');
    expect(variant.internalClassification, 'A');
    expect(variant.productClassification, 'Tópico');
    expect(variant.requiresSterilization, isTrue);
    expect(variant.idProdutoEmultec, 4321);
  });

  test('blank optional text reads as absent, not as an empty string', () {
    // The coding columns are partial-unique where not null (spec 0013 §2), so
    // two products saved with `""` would collide where two saved with null
    // would not — and `""` is not a code anyone can look up.
    final variant = CatalogVariant.fromJson({
      ...row(),
      'brand': '   ',
      'unit': '',
      'idProdutoEmultec': null,
    });

    expect(variant.brand, isNull);
    expect(variant.unit, isNull);
    expect(variant.idProdutoEmultec, isNull);
  });
}

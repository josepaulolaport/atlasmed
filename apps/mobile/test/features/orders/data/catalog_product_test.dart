import 'package:atlasmed_mobile_app/features/orders/data/catalog_product.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps catalog product fields and numeric prices from API JSON', () {
    final product = CatalogProduct.fromJson({
      'id': 1,
      'code': 'ATL-001',
      'name': 'AtlasGel',
      'description': 'Gel ortopédico',
      'productGroup': 'Ortopedia',
      'unit': '240g',
      'price': 89.9,
      'price17': '90.00',
      'price18': 91,
      'price20': 92,
      'pictureUrl': 'https://cdn.example.com/atlas-gel.png',
      'isActive': true,
    });

    expect(product.id, 1);
    expect(product.price, 89.9);
    expect(product.price17, 90);
    expect(product.subtitle, 'Gel ortopédico · 240g');
    expect(product.category, 'Ortopedia');
  });
}

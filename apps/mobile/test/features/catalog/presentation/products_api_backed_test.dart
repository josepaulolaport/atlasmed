import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/products_home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final family = CatalogFamily(
    id: 11,
    name: 'Reviscon',
    manufacturer: 'VSY',
    countryOfOrigin: 'Alemanha',
    variants: [_variant, _secondVariant],
    brasindicePublishedAt: DateTime.utc(2026, 8, 1),
    simproPublishedAt: DateTime.utc(2026, 8, 2),
  );

  Widget subject(Widget child) => ProviderScope(
    overrides: [
      catalogFamiliesProvider.overrideWith((ref) async => [family]),
    ],
    child: MaterialApp(home: child),
  );

  testWidgets('products list renders catalog families from the provider', (
    tester,
  ) async {
    await tester.pumpWidget(subject(const ProductsHomeScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Reviscon'), findsOneWidget);
    expect(find.text('Fabricante: '), findsOneWidget);
    expect(find.text('VSY'), findsOneWidget);
    expect(find.textContaining('a partir de'), findsOneWidget);
  });

  testWidgets('product detail resolves any variant id in the API family', (
    tester,
  ) async {
    await tester.pumpWidget(subject(const ProductDetailScreen(familyId: 12)));
    await tester.pumpAndSettle();

    expect(find.text('00308556'), findsOneWidget);
    expect(find.text('024848'), findsOneWidget);
    expect(find.text('0000094528'), findsOneWidget);
    expect(find.text('Brasíndice: 01/08/2026'), findsOneWidget);
    expect(find.text('Simpro: 02/08/2026'), findsOneWidget);
  });
}

final _variant = CatalogVariant(
  id: 11,
  code: 'REVISCON-1',
  name: 'Reviscon 1.0%',
  familyName: 'Reviscon',
  presentation: '20mg / 2mL',
  manufacturer: 'VSY',
  countryOfOrigin: 'Alemanha',
  simproCode: '00308555',
  brasindiceCode: '024847',
  tissCode: '0000094527',
  price: 1840,
  price17: 1840,
  price18: 1840,
  price20: 1840,
  brasindiceUpdatedAt: DateTime.utc(2026, 8, 1),
);

final _secondVariant = CatalogVariant(
  id: 12,
  code: 'REVISCON-PLUS',
  name: 'Reviscon Plus 1.6%',
  familyName: 'Reviscon',
  presentation: '32mg / 2mL',
  manufacturer: 'VSY',
  countryOfOrigin: 'Alemanha',
  simproCode: '00308556',
  brasindiceCode: '024848',
  tissCode: '0000094528',
  price: 3175,
  price17: 3175,
  price18: 3175,
  price20: 3175,
  brasindiceUpdatedAt: DateTime.utc(2026, 8, 2),
);

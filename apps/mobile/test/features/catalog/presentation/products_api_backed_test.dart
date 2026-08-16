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
    // The card no longer carries a presentation count or a "from" price:
    // both belong to the presentation the detail screen makes you pick.
    expect(find.textContaining('a partir de'), findsNothing);
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

  testWidgets('a family without coding columns still renders, with dashes', (
    tester,
  ) async {
    // Mirrors the production row that broke the screen: EVISC 1.0% ships
    // with null simpro/brasindice/tiss codes and no publication date.
    final bareFamily = CatalogFamily(
      id: 10,
      name: 'Eviscer',
      manufacturer: 'TRB PHARMA',
      countryOfOrigin: 'Brasil',
      variants: [
        CatalogVariant(
          id: 10,
          code: '4064544237823',
          name: 'Eviscer 1.0%',
          familyName: 'Eviscer',
          presentation: '',
          manufacturer: 'TRB PHARMA',
          countryOfOrigin: 'Brasil',
          simproCode: '',
          brasindiceCode: '',
          tissCode: '',
          price: 2855,
          price17: 2855,
          price18: 2855,
          price20: 2855,
          brasindiceUpdatedAt: null,
        ),
      ],
      brasindicePublishedAt: null,
      simproPublishedAt: null,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          catalogFamiliesProvider.overrideWith((ref) async => [bareFamily]),
        ],
        child: MaterialApp(home: const ProductDetailScreen(familyId: 10)),
      ),
    );
    await tester.pumpAndSettle();

    // Codes panel shows dashes instead of throwing on the missing codes.
    expect(find.text('SIMPRO'), findsOneWidget);
    expect(find.text('—'), findsNWidgets(3));
    expect(find.text('Brasíndice: —'), findsOneWidget);
    expect(find.text('Simpro: —'), findsOneWidget);
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

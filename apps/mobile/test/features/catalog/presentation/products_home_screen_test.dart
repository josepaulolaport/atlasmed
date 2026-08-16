import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/products_home_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

CatalogVariant _variant(double price) => CatalogVariant(
  id: 1,
  code: 'X',
  name: 'X',
  familyName: 'X',
  presentation: '1ml',
  manufacturer: 'BIOMATERIAL',
  countryOfOrigin: 'BR',
  simproCode: '',
  brasindiceCode: '',
  tissCode: '',
  price: price,
  price17: price,
  price18: price,
  price20: price,
  brasindiceUpdatedAt: null,
);

CatalogFamily family({
  required int id,
  required String name,
  required double price,
}) => CatalogFamily(
  id: id,
  name: name,
  manufacturer: 'BIOMATERIAL',
  countryOfOrigin: 'BR',
  variants: [_variant(price)],
  brasindicePublishedAt: null,
  simproPublishedAt: null,
);

Future<void> pumpProducts(
  WidgetTester tester,
  List<CatalogFamily> families,
) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        catalogFamiliesProvider.overrideWith((ref) async => families),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const ProductsHomeScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  final catalogue = [
    family(id: 1, name: 'REVISCON 1.0', price: 1840),
    family(id: 2, name: 'EVISC MORE 2.0', price: 5650),
    family(id: 3, name: 'EVISC 1.0', price: 2855),
  ];

  testWidgets('the filter button sorts the list', (tester) async {
    // It was wired to `() {}` — a control on the busiest row of the screen
    // that did nothing, while three sibling screens open a real sheet.
    await pumpProducts(tester, catalogue);

    await tester.tap(find.byIcon(Icons.tune_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('product-sort-priceAscending')));
    await tester.pumpAndSettle();

    // Cheapest first: REVISCON 1840, EVISC 2855, EVISC MORE 5650.
    expect(
      tester.getTopLeft(find.text('REVISCON 1.0')).dy,
      lessThan(tester.getTopLeft(find.text('EVISC MORE 2.0')).dy),
    );
  });

  testWidgets('the most expensive can be put first', (tester) async {
    await pumpProducts(tester, catalogue);

    await tester.tap(find.byIcon(Icons.tune_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('product-sort-priceDescending')));
    await tester.pumpAndSettle();

    expect(
      tester.getTopLeft(find.text('EVISC MORE 2.0')).dy,
      lessThan(tester.getTopLeft(find.text('REVISCON 1.0')).dy),
    );
  });

  testWidgets('the default order is by name', (tester) async {
    await pumpProducts(tester, catalogue);

    // Alphabetical: EVISC 1.0, EVISC MORE 2.0, REVISCON 1.0.
    expect(
      tester.getTopLeft(find.text('EVISC 1.0')).dy,
      lessThan(tester.getTopLeft(find.text('REVISCON 1.0')).dy),
    );
  });

  testWidgets('the list says how many products it holds', (tester) async {
    await pumpProducts(tester, catalogue);

    expect(find.text('3 produtos'), findsOneWidget);
  });

  testWidgets('a search that misses is not an empty catalogue', (tester) async {
    // One message covered both, and only one of them is worth retyping over.
    await pumpProducts(tester, catalogue);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();

    expect(find.text('Nenhum produto encontrado'), findsOneWidget);
    expect(find.textContaining('"zzz"'), findsOneWidget);
    expect(find.text('Catálogo vazio'), findsNothing);
  });

  testWidgets('an empty catalogue says so', (tester) async {
    await pumpProducts(tester, const []);

    expect(find.text('Catálogo vazio'), findsOneWidget);
  });
}

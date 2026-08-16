import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// The product write body encodes three spec rules at once (0016 §5.1, §6.7,
/// §7.1). Each is asserted here because each was wrong at some point in a way
/// that produced data rather than an error.
void main() {
  CatalogVariant variant({
    String code = 'REV-1',
    String simproCode = '00308555',
    String brasindiceCode = '024847',
    String tissCode = '0000094527',
    String? productGroup = 'REVISCON',
    DateTime? brasindiceUpdatedAt,
    bool isActive = true,
  }) => CatalogVariant(
    id: 1,
    code: code,
    name: 'REVISCON 1.0%',
    familyName: productGroup ?? 'REVISCON 1.0%',
    presentation: '20MG / 2ML',
    manufacturer: 'VSY',
    countryOfOrigin: 'Alemanha',
    simproCode: simproCode,
    brasindiceCode: brasindiceCode,
    tissCode: tissCode,
    price: 1840,
    price17: 1840,
    price18: 1840,
    price20: 1840,
    brasindiceUpdatedAt: brasindiceUpdatedAt,
    isActive: isActive,
    verticalIds: const [1, 2],
    productGroup: productGroup,
    metricUnits: 5,
  );

  test('never sends verticalIds — Linhas are chosen once', () {
    // Spec 0016 §6.7. `createVariant` adds them on top; the shared body must
    // not, or an edit would move a product whose orders are already keyed to
    // its old Linha.
    expect(productRequestBody(variant()).containsKey('verticalIds'), isFalse);
  });

  test('never sends metricUnits, even when the product carries one', () {
    // Spec 0016 §7.1: informative field, no writer. The variant above is at 5
    // deliberately — if this ever leaks, it leaks a non-default value.
    expect(productRequestBody(variant()).containsKey('metricUnits'), isFalse);
  });

  test('blank codes are sent as null, not as empty strings', () {
    // Spec 0013 §2: the coding columns are partial-unique where not null, so
    // `""` would make the second uncoded product collide with the first.
    final body = productRequestBody(
      variant(code: '', simproCode: '  ', brasindiceCode: '', tissCode: ''),
    );

    expect(body['code'], isNull);
    expect(body['simproCode'], isNull);
    expect(body['brasindiceCode'], isNull);
    expect(body['tissCode'], isNull);
  });

  test('sends the Brasíndice date as a plain date, and null when unset', () {
    expect(
      productRequestBody(
        variant(brasindiceUpdatedAt: DateTime.utc(2026, 8, 1)),
      )['brasindiceUpdatedAt'],
      '2026-08-01',
    );
    // Present-and-null rather than absent: that is how the date is cleared
    // alongside the code it belongs to.
    final body = productRequestBody(variant());
    expect(body.containsKey('brasindiceUpdatedAt'), isTrue);
    expect(body['brasindiceUpdatedAt'], isNull);
  });

  test('sends productGroup, so the Família field is not silently discarded', () {
    // It never was sent: the form asked for a family, the request omitted it,
    // and the saved product came back grouped under its own name.
    expect(productRequestBody(variant())['productGroup'], 'REVISCON');
    expect(
      productRequestBody(variant(productGroup: null))['productGroup'],
      isNull,
    );
  });

  test('folds the presentation into the name the API stores', () {
    expect(productRequestBody(variant())['name'], 'REVISCON 1.0% - 20MG / 2ML');
  });

  test('carries the active flag both ways', () {
    expect(productRequestBody(variant())['isActive'], isTrue);
    expect(productRequestBody(variant(isActive: false))['isActive'], isFalse);
  });
}

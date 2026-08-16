import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/brasindice_date.dart';
import 'package:flutter_test/flutter_test.dart';

/// The comparison behind the variant form's "os preços mudaram e esta data
/// não" hint.
///
/// It arrived as `brasindiceDateForSave`, which moved the date itself whenever
/// a price moved. The form now asks the admin for the date instead — a price
/// typed today is not evidence Brasíndice published today — so what is tested
/// here is the comparison alone.
void main() {
  test('an edit that leaves every price alone is not a change', () {
    expect(
      brasindicePricesChanged(
        current: const [10.0, 11.0, 12.0],
        saved: const [10.0, 11.0, 12.0],
      ),
      isFalse,
    );
  });

  test('any one price moving counts', () {
    expect(
      brasindicePricesChanged(
        current: const [10.0, 11.0, 99.0],
        saved: const [10.0, 11.0, 12.0],
      ),
      isTrue,
    );
  });

  test('an unparseable price counts as a change rather than silently '
      'matching', () {
    // A field the form cannot read is not evidence that nothing moved.
    expect(
      brasindicePricesChanged(
        current: const [null, 11.0, 12.0],
        saved: const [10.0, 11.0, 12.0],
      ),
      isTrue,
    );
  });

  test('a price cleared to null counts', () {
    expect(
      brasindicePricesChanged(current: const [null], saved: const [10.0]),
      isTrue,
    );
  });

  test('lists of different lengths count as a change', () {
    // Nothing produces this today; it is here so a caller that starts sending
    // a fourth price gets a hint rather than silence.
    expect(
      brasindicePricesChanged(current: const [10.0, 11.0], saved: const [10.0]),
      isTrue,
    );
  });

  test('two empty lists are not a change', () {
    expect(
      brasindicePricesChanged(current: const [], saved: const []),
      isFalse,
    );
  });
}

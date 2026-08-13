import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:flutter_test/flutter_test.dart';

/// The chip showing the current sort rendered raw internal keys.
///
/// `SortRow.labelFor` handled four keys and returned the key itself for
/// everything else, so Explorar displayed "purchase-funnel-desc" and
/// "name-desc" to reps while the sheet showed "Status de compras — inverso"
/// and "Nome Z–A" for the very same options. Seven of the nine clinic sorts
/// were affected. Seen in production on 2026-08-13.
///
/// Walking the sheet's real option list rather than a copy: a hardcoded list
/// here would drift the moment someone adds a sort, which is exactly how the
/// original gap opened.
void main() {
  const kinds = ['clinic', 'facility-people', 'doctor'];

  for (final kind in kinds) {
    for (final hasLocation in [true, false]) {
      test('every $kind sort option has a label (hasLocation: $hasLocation)', () {
        final keys = SortSheet.optionKeysFor(
          kind: kind,
          hasLocation: hasLocation,
        );

        expect(keys, isNotEmpty, reason: 'no options offered for $kind');

        for (final key in keys) {
          final label = SortRow.labelFor(key);
          expect(
            label,
            isNot(equals(key)),
            reason:
                '"$key" falls through to the default branch, so the chip would '
                'show the internal key instead of a label',
          );
          expect(label, isNotEmpty);
        }
      });
    }
  }

  test('distance is only offered when the app has a location', () {
    expect(
      SortSheet.optionKeysFor(kind: 'clinic', hasLocation: true),
      contains('distance'),
    );
    expect(
      SortSheet.optionKeysFor(kind: 'clinic', hasLocation: false),
      isNot(contains('distance')),
    );
  });

  test('the two name directions are distinct labels, not one', () {
    // They differ by a single character in the key; a copy-paste that mapped
    // both to "Nome A–Z" would leave the chip lying about the current sort.
    expect(
      SortRow.labelFor('name-asc'),
      isNot(equals(SortRow.labelFor('name-desc'))),
    );
  });
}

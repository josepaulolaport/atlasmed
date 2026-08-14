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

  test('a pair shares its label and differs by direction', () {
    // The two directions used to be distinct strings — "Nome A–Z" against
    // "Nome Z–A", and "Status de compras" against "Status de compras —
    // inverso". The suffix made the chip long enough to overlap the tabs, so
    // the distinction moved to an arrow. The pair must still be
    // distinguishable, just not by the words.
    for (final pair in [
      ('name-asc', 'name-desc'),
      ('purchase-funnel-asc', 'purchase-funnel-desc'),
      ('purchase-interval-asc', 'purchase-interval-desc'),
      ('last-purchase-asc', 'last-purchase-desc'),
    ]) {
      expect(SortRow.labelFor(pair.$1), SortRow.labelFor(pair.$2));
      expect(
        SortRow.directionFor(pair.$1),
        isNot(equals(SortRow.directionFor(pair.$2))),
        reason: '${pair.$1} and ${pair.$2} would look identical in the chip',
      );
    }
  });

  test('every label is short enough for a chip beside the tabs', () {
    // Two words at most. "Status de compras — inverso" is what pushed the chip
    // over the Clínicas/Médicos tabs.
    for (final kind in kinds) {
      for (final key in SortSheet.optionKeysFor(
        kind: kind,
        hasLocation: true,
      )) {
        final label = SortRow.labelFor(key);
        expect(
          label.split(' ').length,
          lessThanOrEqualTo(2),
          reason: '"$label" ($key) is longer than two words',
        );
        expect(label, isNot(contains('—')));
      }
    }
  });

  test('ascending is the default, descending only where the key says so', () {
    // A key ending in -desc that reported ascending would point the arrow the
    // wrong way while the list was right, which is worse than no arrow.
    expect(SortRow.directionFor('name-asc'), SortChipDirection.ascending);
    expect(SortRow.directionFor('name-desc'), SortChipDirection.descending);
    expect(SortRow.directionFor('distance'), SortChipDirection.ascending);
    expect(
      SortRow.directionFor('last-purchase-desc'),
      SortChipDirection.descending,
    );
  });
}

import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_metric_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// "Clínicas atribuídas" was the one Desempenho card built without a caption,
/// and `MetricValue` only renders that line when it is given one — so the card
/// came out shorter than "Cobertura" beside it.
///
/// Two things to hold: the caption exists, and the grid pairs cards into rows
/// that share a height. The second matters on its own — a caption that wraps to
/// a second line at a narrow width would leave the same gap.
Widget _grid(List<Widget> cards) => MaterialApp(
  home: Scaffold(
    body: SizedBox(width: 380, child: MetricCardGrid(cards: cards)),
  ),
);

/// A card's chrome around a `MetricValue`, without the repository plumbing —
/// this is a test about height, and the async wrapper only obstructs measuring
/// it. `mainAxisSize.min` is what makes an unpadded card collapse to its
/// content, which is exactly the failure being pinned.
Widget _card(Key key, Widget child) => Container(
  key: key,
  padding: const EdgeInsets.all(14),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [const Text('Título'), const SizedBox(height: 10), child],
  ),
);

Size _sizeOf(WidgetTester tester, String key) =>
    tester.getSize(find.byKey(Key(key)));

void main() {
  testWidgets('a card with no caption still matches its neighbour', (
    tester,
  ) async {
    await tester.pumpWidget(
      _grid([
        _card(const Key('left'), const MetricValue(value: '42')),
        _card(
          const Key('right'),
          const MetricValue(value: '6%', caption: '84 de 1424 já compraram'),
        ),
      ]),
    );

    expect(_sizeOf(tester, 'left').height, _sizeOf(tester, 'right').height);
  });

  testWidgets('a caption wrapping to two lines still matches its neighbour', (
    tester,
  ) async {
    await tester.pumpWidget(
      _grid([
        _card(
          const Key('left'),
          const MetricValue(value: '42', caption: 'com consultor responsável'),
        ),
        _card(
          const Key('right'),
          const MetricValue(
            value: '6%',
            caption:
                'uma legenda bem mais longa que certamente ocupa duas linhas '
                'nesta largura de cartão',
          ),
        ),
      ]),
    );

    final left = _sizeOf(tester, 'left');
    expect(left.height, _sizeOf(tester, 'right').height);
    // The row really did grow for the long caption, so the assertion above is
    // not comparing two cards that both happen to be the minimum height.
    expect(left.height, greaterThan(70));
  });

  testWidgets('an odd card keeps half the row rather than spanning it', (
    tester,
  ) async {
    await tester.pumpWidget(
      _grid([
        _card(const Key('a'), const MetricValue(value: '1')),
        _card(const Key('b'), const MetricValue(value: '2')),
        _card(const Key('c'), const MetricValue(value: '3')),
      ]),
    );

    expect(_sizeOf(tester, 'c').width, _sizeOf(tester, 'a').width);
    expect(_sizeOf(tester, 'c').width, lessThan(380));
  });

  testWidgets('MetricValue renders the caption it is given', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MetricValue(value: '42', caption: 'com consultor responsável'),
        ),
      ),
    );

    expect(find.text('42'), findsOneWidget);
    expect(find.text('com consultor responsável'), findsOneWidget);
  });
}

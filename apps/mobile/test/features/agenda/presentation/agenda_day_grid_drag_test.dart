import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_grid.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _day = DateTime(2026, 8, 16);

/// The grid with the screen's own job done for it: hold the draft, hand back
/// every change. Without this the block never moves, because the widget is
/// deliberately not the owner of what it is drawing.
class _Harness extends StatefulWidget {
  const _Harness({required this.initial});

  final DayGridDraft initial;

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  late DayGridDraft draft = widget.initial;

  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      body: AgendaDayGrid(
        day: _day,
        occurrences: const [],
        now: DateTime(2026, 8, 16, 17),
        draft: draft,
        onDraftStarted: (value) => setState(() => draft = value),
        onDraftChanged: (value) => setState(() => draft = value),
      ),
    ),
  );
}

Future<_HarnessState> _pumpGrid(
  WidgetTester tester,
  DayGridDraft initial,
) async {
  await tester.pumpWidget(_Harness(initial: initial));
  await tester.pumpAndSettle();
  return tester.state<_HarnessState>(find.byType(_Harness));
}

/// One frame of an ordinary drag. Small on purpose: this is the size of step
/// the old code threw away.
const _framePixels = 8.0;

/// The block's own top-left, derived from its label — the label sits at the
/// block's top-left inside the padding.
Offset _blockTopLeft(WidgetTester tester, String label) =>
    tester.getTopLeft(find.text(label)).translate(-10, -4);

/// Somewhere in the middle of the block: past the resize handles, which own the
/// leftmost 44px of each edge.
Offset _blockBody(WidgetTester tester, String label) =>
    _blockTopLeft(tester, label).translate(150, 32);

void main() {
  const oneHourAtFive = DayGridDraft(
    startMinutes: 17 * 60,
    endMinutes: 18 * 60,
  );

  testWidgets('a slow drag moves the block', (tester) async {
    // The defect this test exists for. `moveDraft` snaps to a half hour and the
    // grid used to hand it one frame's delta at a time — eight pixels is seven
    // and a half minutes, which snaps to nothing. Every frame rounded its own
    // movement away, so a careful drag did nothing at all and the block only
    // jumped when a flick happened to cover sixteen pixels between two frames.
    final state = await _pumpGrid(tester, oneHourAtFive);

    final gesture = await tester.startGesture(
      _blockBody(tester, '17:00–18:00'),
    );
    // 12 frames × 8px = 96px = 90 minutes.
    for (var i = 0; i < 12; i += 1) {
      await gesture.moveBy(const Offset(0, _framePixels));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();

    expect(state.draft.startMinutes, 18 * 60 + 30);
    expect(state.draft.durationMinutes, 60);
  });

  testWidgets('a drag that ends up nowhere leaves the block alone', (
    tester,
  ) async {
    // Down and back up again. Accumulating raw pixels has to mean the round
    // trip cancels, not that it lands a slot away from where it started.
    final state = await _pumpGrid(tester, oneHourAtFive);

    final gesture = await tester.startGesture(
      _blockBody(tester, '17:00–18:00'),
    );
    for (var i = 0; i < 6; i += 1) {
      await gesture.moveBy(const Offset(0, _framePixels));
      await tester.pump();
    }
    for (var i = 0; i < 6; i += 1) {
      await gesture.moveBy(const Offset(0, -_framePixels));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();

    expect(state.draft.startMinutes, 17 * 60);
  });

  testWidgets('a second drag starts from where the first one left it', (
    tester,
  ) async {
    // The anchor is captured per gesture. If it were captured once, the second
    // drag would measure from the original position and undo the first.
    final state = await _pumpGrid(tester, oneHourAtFive);

    // Two 30-minute drags, one after the other.
    for (var drag = 0; drag < 2; drag += 1) {
      final label =
          '${formatSlot(state.draft.startMinutes)}–'
          '${formatSlot(state.draft.endMinutes)}';
      final gesture = await tester.startGesture(_blockBody(tester, label));
      for (var i = 0; i < 4; i += 1) {
        await gesture.moveBy(const Offset(0, _framePixels));
        await tester.pump();
      }
      await gesture.up();
      await tester.pump();
    }

    expect(state.draft.startMinutes, 18 * 60);
  });

  testWidgets('the resize handle is grabbable beside its dot', (tester) async {
    // The handles sat half outside the block, and a box has to be inside its
    // Stack to be hit at all — so the outer half of each was dead and the rep
    // was pressing a circle that ignored them.
    final state = await _pumpGrid(tester, oneHourAtFive);

    final corner = _blockTopLeft(tester, '17:00–18:00');

    // Beside the dot, not on it.
    final gesture = await tester.startGesture(corner.translate(30, 0));
    for (var i = 0; i < 4; i += 1) {
      await gesture.moveBy(const Offset(0, _framePixels));
      await tester.pump();
    }
    await gesture.up();
    await tester.pump();

    // The top edge moved down; the end stayed where it was.
    expect(state.draft.startMinutes, 17 * 60 + 30);
    expect(state.draft.endMinutes, 18 * 60);
  });
}

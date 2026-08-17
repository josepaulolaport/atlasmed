import 'package:atlasmed_mobile_app/shared/widgets/dismiss_keyboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Tapping away from a field closes the keyboard.
///
/// Nothing in the app did this. A keyboard opened by any field stayed up until
/// the field gave up focus, which most screens never arranged — so on a sheet
/// whose only button sits under the keyboard, the sole way out was to submit
/// something. Wrapped once at the app root, so it is not a thing to remember
/// per screen.
Widget host({VoidCallback? onButton}) => MaterialApp(
  home: DismissKeyboardOnTapOutside(
    child: Scaffold(
      body: Column(
        children: [
          const TextField(key: Key('field')),
          const SizedBox(height: 20),
          const Text('algo que não é um campo', key: Key('inert')),
          ElevatedButton(
            key: const Key('button'),
            onPressed: onButton ?? () {},
            child: const Text('botão'),
          ),
        ],
      ),
    ),
  ),
);

void main() {
  testWidgets('a tap on inert content drops focus', (tester) async {
    await tester.pumpWidget(host());

    await tester.tap(find.byKey(const Key('field')));
    await tester.pump();
    expect(
      FocusManager.instance.primaryFocus?.hasFocus,
      isTrue,
      reason: 'the field should hold focus once tapped',
    );

    await tester.tap(find.byKey(const Key('inert')));
    await tester.pumpAndSettle();

    expect(
      tester.widget<EditableText>(find.byType(EditableText)).focusNode.hasFocus,
      isFalse,
    );
  });

  testWidgets('a button under the wrapper still fires', (tester) async {
    // The wrapper is translucent and only observes. If it swallowed taps it
    // would be a worse bug than the one it fixes.
    var pressed = 0;
    await tester.pumpWidget(host(onButton: () => pressed++));

    await tester.tap(find.byKey(const Key('button')));
    await tester.pumpAndSettle();

    expect(pressed, 1);
  });

  testWidgets('a control that handles its own tap keeps the focus', (
    tester,
  ) async {
    // Deliberate, and worth stating because it looks like a gap. The wrapper
    // listens for taps the rest of the tree ignored; a button wins the gesture
    // arena, so the wrapper never sees it. That is the behaviour we want — a
    // toggle on a half-filled form should not close the keyboard under the
    // person still typing. Screens that do want it gone say so themselves.
    await tester.pumpWidget(host());

    await tester.tap(find.byKey(const Key('field')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('button')));
    await tester.pumpAndSettle();

    expect(
      tester.widget<EditableText>(find.byType(EditableText)).focusNode.hasFocus,
      isTrue,
    );
  });

  testWidgets('tapping the field itself keeps focus', (tester) async {
    // The wrapper must not fight the thing it is meant to leave alone.
    await tester.pumpWidget(host());

    await tester.tap(find.byKey(const Key('field')));
    await tester.pumpAndSettle();

    expect(
      tester.widget<EditableText>(find.byType(EditableText)).focusNode.hasFocus,
      isTrue,
    );
  });
}

import 'package:flutter/material.dart';

/// Drops focus when a tap lands on something that is not a text field.
///
/// Nothing in the app did this. A keyboard opened by any field stayed up until
/// the field itself gave up focus, which most screens never arranged — so on a
/// sheet whose only button sits under the keyboard, the sole way out was to
/// submit. Tapping the page behind it did nothing, because a tap on ordinary
/// widgets is not a focus change.
///
/// Wrapped once at the app root rather than per screen: the fix is the same
/// everywhere, and a per-screen version is a thing to forget on the next
/// screen. Two screens had already grown their own copy.
///
/// `translucent` so the tap still reaches whatever is underneath — this only
/// observes. Buttons, list rows and the map keep working, and a drag is not a
/// tap, so scrolling and panning are untouched.
class DismissKeyboardOnTapOutside extends StatelessWidget {
  const DismissKeyboardOnTapOutside({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      // No `onTapDown`: that fires before the arena resolves, so a tap that
      // turns out to belong to a button would still steal focus first.
      onTap: () {
        final focus = FocusManager.instance.primaryFocus;
        // Only unfocus something that actually holds a keyboard. Dropping focus
        // unconditionally would fight widgets that keep it for their own
        // reasons — a focused list for keyboard navigation, for one.
        if (focus == null || !focus.hasFocus) return;
        focus.unfocus();
      },
      child: child,
    );
  }
}

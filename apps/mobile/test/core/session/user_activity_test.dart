import 'package:atlasmed_mobile_app/core/session/user_activity.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() => UserActivity.instance.reset());

  group('UserActivity (spec 0015 §4.1)', () {
    test('an untouched app is not active', () {
      // The state that motivates all of this: the app is open, the session
      // token refreshes every eight minutes, and nobody is there.
      expect(UserActivity.instance.isActive, isFalse);
    });

    test('a touch makes the next requests count', () {
      UserActivity.instance.recordInteraction();
      expect(UserActivity.instance.isActive, isTrue);
    });

    test('backgrounding stops the credit immediately', () {
      // Timers keep firing for a moment after the app leaves the screen, and
      // those requests are the system's, not a person's.
      UserActivity.instance.recordInteraction();
      UserActivity.instance.setForeground(false);

      expect(UserActivity.instance.isActive, isFalse);
    });

    test('reopening the app is itself an interaction', () {
      // Deliberately coming back to the app is exactly the signal the field is
      // for, and waiting for the first tap would lose it.
      UserActivity.instance.setForeground(false);
      UserActivity.instance.setForeground(true);

      expect(UserActivity.instance.isActive, isTrue);
    });

    test('the window is wide enough for one tap to finish its work', () {
      // A tap opens a screen, which fetches four cards, which pages a list.
      // Those are all that one interaction, and they must all count.
      expect(UserActivity.window.inMinutes, greaterThanOrEqualTo(1));
      expect(UserActivity.window.inMinutes, lessThanOrEqualTo(5));
    });
  });

  testWidgets('a pointer anywhere counts, without stealing the gesture', (
    tester,
  ) async {
    // Translucent hit testing is what makes this safe to wrap the whole app in:
    // the button underneath must still receive its tap.
    var buttonTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: UserActivityTracker(
          child: Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => buttonTapped = true,
                child: const Text('Toque'),
              ),
            ),
          ),
        ),
      ),
    );

    expect(UserActivity.instance.isActive, isFalse);

    await tester.tap(find.text('Toque'));
    await tester.pump();

    expect(buttonTapped, isTrue);
    expect(UserActivity.instance.isActive, isTrue);
  });
}

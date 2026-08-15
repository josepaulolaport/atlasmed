import 'package:flutter/widgets.dart';

/// Whether a person is actually using the app right now (spec 0015 §4.1).
///
/// `last_seen_at` is meant to answer "is this rep still using the app". Every
/// authenticated request used to move it, and the session token refreshes on an
/// eight-minute timer — so a phone left face-down on a desk kept reporting the
/// person as active indefinitely, and the field said something it did not mean.
///
/// This records the last real interaction. The HTTP clients read [isActive] and
/// mark outgoing requests, and the API refreshes the timestamp only for those.
///
/// A monostate rather than a provider: the HTTP clients are built outside the
/// widget tree and have no `ref` to read, and there is exactly one user of one
/// app at a time.
class UserActivity {
  UserActivity._();

  static final UserActivity instance = UserActivity._();

  /// How long after a touch requests still count as user-driven.
  ///
  /// Wide enough to cover the work one interaction sets off — a tap that opens
  /// a screen, which fetches four cards, which pages a list — and short enough
  /// that a timer firing minutes later does not inherit the credit.
  static const window = Duration(minutes: 2);

  DateTime? _lastInteraction;
  bool _foreground = true;

  /// Called from the root pointer listener on every touch.
  void recordInteraction() => _lastInteraction = DateTime.now();

  void setForeground(bool value) {
    _foreground = value;
    // Coming back to the app is itself an interaction: the person deliberately
    // reopened it, which is exactly the signal this field is for.
    if (value) recordInteraction();
  }

  /// True when this request can honestly be attributed to a person.
  bool get isActive {
    if (!_foreground) return false;
    final last = _lastInteraction;
    if (last == null) return false;
    return DateTime.now().difference(last) < window;
  }

  @visibleForTesting
  void reset() {
    _lastInteraction = null;
    _foreground = true;
  }
}

/// Records every touch anywhere in the app.
///
/// `Listener` with [HitTestBehavior.translucent] sees pointer-downs on their way
/// to whatever handles them, so it never competes for a gesture — no button,
/// scroll or drag behaves differently for being wrapped.
class UserActivityTracker extends StatelessWidget {
  const UserActivityTracker({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => UserActivity.instance.recordInteraction(),
      child: child,
    );
  }
}

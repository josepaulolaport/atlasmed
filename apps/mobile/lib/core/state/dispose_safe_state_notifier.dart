import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Drops state writes that land after the notifier was disposed.
///
/// Every loader here follows the same shape: kick off a request, await it,
/// assign the result. Behind an `autoDispose` provider the notifier is gone the
/// moment the user leaves the screen, so a request still in flight comes back
/// to a disposed object and `StateNotifier` throws
/// `Bad state: Tried to use X after dispose was called`.
///
/// Nothing is being suppressed: leaving a screen mid-request is ordinary, and
/// the answer to "what should a write to a discarded notifier do?" is nothing.
/// A per-call-site `if (mounted)` would express the same rule, but only until
/// the next loader forgets it.
mixin DisposeSafeStateWrites<State> on StateNotifier<State> {
  @override
  set state(State value) {
    if (!mounted) return;
    super.state = value;
  }
}

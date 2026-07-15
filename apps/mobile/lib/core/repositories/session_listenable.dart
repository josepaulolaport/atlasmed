import 'dart:async';

import 'package:flutter/foundation.dart';
import 'session_environment.dart';

/// A [ChangeNotifier] that bridges [SessionEnvironment]'s reactive stream
/// to GoRouter's [refreshListenable].
///
/// Usage in [GoRouter]:
/// ```dart
/// final routerRefreshNotifier = SessionListenable();
///
/// GoRouter(
///   refreshListenable: routerRefreshNotifier,
///   redirect: (context, state) {
///     final session = routerRefreshNotifier.currentSession;
///     // redirect logic...
///   },
/// )
/// ```
class SessionListenable extends ChangeNotifier {
  StreamSubscription<AuthenticationState>? _subscription;
  AuthenticationState _state = AuthenticationState.unauthenticated;

  SessionListenable() {
    _subscription =
        SessionEnvironment.instance.authState.listen((authState) {
      _state = authState;
      notifyListeners();
    });
  }

  /// Whether the user is currently authenticated.
  bool get isAuthenticated =>
      _state == AuthenticationState.authenticated;

  /// The current auth state.
  AuthenticationState get currentState => _state;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

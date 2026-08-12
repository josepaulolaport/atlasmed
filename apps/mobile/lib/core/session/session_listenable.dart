import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:atlasmed_mobile_app/core/session/models/session.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';

class SessionListenable extends ChangeNotifier {
  SessionListenable(this.sessionEnvironment) {
    _subscription = sessionEnvironment.dataStream.listen(
      (_) => notifyListeners(),
      // A session that cannot be loaded is not an authenticated one: notify so
      // the router re-evaluates and lands on the login flow.
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('SessionListenable: session stream failed: $error');
        notifyListeners();
      },
    );
  }

  final SessionEnvironment sessionEnvironment;
  StreamSubscription<Session?>? _subscription;

  bool get isAuthenticated => sessionEnvironment.currentValue != null;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../features/auth/data/models/session.dart';
import 'session_environment.dart';

class SessionListenable extends ChangeNotifier {
  SessionListenable(this.sessionEnvironment) {
    _subscription = sessionEnvironment.dataStream.listen((_) {
      notifyListeners();
    });
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

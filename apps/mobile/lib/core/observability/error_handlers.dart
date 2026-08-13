import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Installs the two handlers Flutter offers for errors nobody caught.
///
/// Without them an uncaught async error is printed by the Flutter runtime and
/// then forgotten: unreadable in a debug console, invisible in release. The
/// Crashlytics SDK has shipped in this app (and in the iOS symbol-upload build
/// phase) since before this was wired, reporting nothing.
Future<void> installErrorHandlers() async {
  final crashlytics = FirebaseCrashlytics.instance;

  // Debug runs would otherwise report every hot-reload mistake as a crash.
  await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

  final presentError = FlutterError.onError;
  FlutterError.onError = (details) {
    presentError?.call(details);
    crashlytics.recordFlutterError(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Uncaught async error: $error\n$stack');

    // Not `fatal`: these reach the zone from background work and the app keeps
    // running, so counting them as crashes would misreport crash-free sessions.
    crashlytics.recordError(error, stack, fatal: false);
    return true;
  };
}

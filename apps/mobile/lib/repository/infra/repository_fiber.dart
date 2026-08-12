import 'dart:async';
import 'dart:developer';

/// {@template fiber}
/// A fiber is a class that ensures that only
/// one async function is running at a time.
/// {@endtemplate}
class RepositoryFiber<Data> {
  /// {@macro fiber}
  RepositoryFiber();

  /// The completer that completes when the async function is done.
  Completer<Data>? _completer;

  /// Returns true if there is one or more async functions running.
  bool get isBusy {
    return _completer?.isCompleted == false;
  }

  /// Runs an async function and returns a `Future` that
  /// completes with the result of the function.
  /// If there is already a running async function, it will
  /// wait for it to complete.
  /// If there is no running async function, it will run the
  /// function and complete the `Future`.
  Future<Data> run(Future<Data> Function() fn, {String? name}) async {
    log('[RepositoryFiber] Running fiber $name');
    final currentCompleter = _completer;

    if (currentCompleter != null && !currentCompleter.isCompleted) {
      return currentCompleter.future;
    }

    log('[RepositoryFiber] Creating new completer for $name');
    final newCompleter = Completer<Data>();
    _completer = newCompleter;

    try {
      log('[RepositoryFiber] Executing function $name');
      newCompleter.complete(await fn());
    } catch (error, stackTrace) {
      log('[RepositoryFiber] Completing completer with error for $name');
      newCompleter.completeError(error, stackTrace);
    } finally {
      log('[RepositoryFiber] Completing fiber $name');
      _completer = null;
    }

    // The caller gets the completer's future rather than a rethrow: with a
    // rethrow the completer's own future carried an error nobody listened to
    // whenever no second caller had joined the fiber, and Dart reported it as
    // an unhandled async error on top of the one the caller already saw.
    return newCompleter.future;
  }
}

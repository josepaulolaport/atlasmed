/// A refresh that failed without anyone awaiting it.
///
/// Hydration on construction, the auto-refresh timer and dependency fan-out all
/// start refreshes in the background. Before this existed their exceptions
/// escaped to the zone and were printed by the Flutter runtime, which read as a
/// crash while the UI simply stayed empty.
class RepositoryFailure {
  const RepositoryFailure({
    required this.error,
    required this.stackTrace,
    required this.trigger,
  });

  final Object error;

  final StackTrace stackTrace;

  /// What started the refresh — 'hydration', 'auto refresh', or the dependency
  /// that fanned out. Kept for logs: the same error means different things
  /// depending on whether a screen was waiting for it.
  final String trigger;

  @override
  String toString() => 'RepositoryFailure($trigger): $error';
}

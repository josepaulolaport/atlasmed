/// Rejects stale asynchronous viewport reads when map-idle callbacks overlap.
class MapViewportLoadGuard {
  int _epoch = 0;

  int begin() => ++_epoch;

  void invalidate() => _epoch++;

  bool isCurrent(int request) => request == _epoch;
}

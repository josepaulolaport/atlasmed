import 'package:atlasmed_mobile_app/features/map/presentation/utils/map_viewport_load_guard.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('only the latest viewport load remains current', () {
    final guard = MapViewportLoadGuard();

    final first = guard.begin();
    final second = guard.begin();

    expect(guard.isCurrent(first), isFalse);
    expect(guard.isCurrent(second), isTrue);
  });

  test('invalidate rejects an in-flight viewport load', () {
    final guard = MapViewportLoadGuard();
    final request = guard.begin();

    guard.invalidate();

    expect(guard.isCurrent(request), isFalse);
  });
}

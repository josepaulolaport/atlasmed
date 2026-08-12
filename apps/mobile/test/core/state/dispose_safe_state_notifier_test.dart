import 'dart:async';

import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The shape every loader in the app has: construct, fetch, assign.
class _Loader extends StateNotifier<int> with DisposeSafeStateWrites<int> {
  _Loader(this.request) : super(0) {
    _load();
  }

  final Future<int> request;

  Future<void> _load() async {
    state = await request;
  }
}

class _UnguardedLoader extends StateNotifier<int> {
  _UnguardedLoader(this.request) : super(0) {
    _load();
  }

  final Future<int> request;

  Future<void> _load() async {
    state = await request;
  }
}

void main() {
  group('DisposeSafeStateWrites', () {
    test(
      'a response that lands after dispose is dropped, not thrown',
      () async {
        final request = Completer<int>();
        final loader = _Loader(request.future);

        // The user leaves the screen while the request is still in flight.
        loader.dispose();
        request.complete(7);

        await expectLater(Future<void>.delayed(Duration.zero), completes);
      },
    );

    test('without the mixin the same sequence throws', () async {
      final request = Completer<int>();
      final escaped = Completer<Object>();

      // The notifier is built inside the zone so that the throw from its
      // suspended `_load` is reported here rather than failing the test.
      await runZonedGuarded(() async {
        final loader = _UnguardedLoader(request.future);
        loader.dispose();
        request.complete(7);
        await Future<void>.delayed(Duration.zero);
      }, (error, _) => escaped.complete(error));

      expect(await escaped.future, isStateError);
    });

    test('writes before dispose still reach listeners', () async {
      final request = Completer<int>();
      final loader = _Loader(request.future);
      final seen = <int>[];
      loader.addListener(seen.add);

      request.complete(7);
      await Future<void>.delayed(Duration.zero);

      expect(seen, [0, 7]);
      loader.dispose();
    });
  });
}

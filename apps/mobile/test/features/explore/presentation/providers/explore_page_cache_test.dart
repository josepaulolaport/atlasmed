import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_page_cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('page provider survives listener gaps inside the TTL', () async {
    var creations = 0;
    final provider = StreamProvider.autoDispose<int>((ref) async* {
      keepExplorePageAlive(ref);
      creations++;
      yield creations;
      await Completer<void>().future;
    });
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final first = container.listen(provider, (_, _) {}, fireImmediately: true);
    await container.read(provider.future);
    first.close();
    await Future<void>.delayed(Duration.zero);

    final second = container.listen(provider, (_, _) {}, fireImmediately: true);
    expect(await container.read(provider.future), 1);
    expect(creations, 1);
    second.close();
  });

  test('a build disposed mid-await is told, and stops touching ref', () async {
    final gate = Completer<void>();
    final lifetimes = <ExplorePageLifetime>[];
    var buildsThatResumedPastTheGate = 0;

    final provider = StreamProvider.autoDispose<int>((ref) async* {
      final lifetime = keepExplorePageAlive(ref);
      lifetimes.add(lifetime);

      // Only the first build suspends, so the rebuild triggered below cannot
      // deadlock waiting on the same gate.
      if (lifetimes.length == 1) {
        await gate.future;
        if (lifetime.isDisposed) return;
        buildsThatResumedPastTheGate++;
      }

      yield lifetimes.length;
    });

    final container = ProviderContainer();
    addTearDown(container.dispose);

    final subscription = container.listen(
      provider,
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    expect(lifetimes, hasLength(1));

    // Mirrors a session-tag change: the suspended build is thrown away while
    // it is still parked on its await.
    container.invalidate(provider);
    expect(lifetimes.first.isDisposed, isTrue);

    gate.complete();
    await Future<void>.delayed(Duration.zero);

    expect(buildsThatResumedPastTheGate, isZero);
  });
}

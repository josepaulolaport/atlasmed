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
}

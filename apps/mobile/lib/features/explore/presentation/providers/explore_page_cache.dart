import 'dart:async';
import 'dart:convert';

import 'package:atlasmed_mobile_app/core/session/models/session.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final exploreSessionCacheTagProvider = StreamProvider<String?>((ref) async* {
  final sessionRepository = ref.watch(sessionProvider);

  String? tagFor(Session? session) {
    if (session == null) return null;
    return sha256.convert(utf8.encode(session.refreshToken)).toString();
  }

  await sessionRepository.waitForHydration();
  yield tagFor(sessionRepository.currentValue);
  await for (final repositoryState in sessionRepository.stream) {
    final session = repositoryState.map<Session?>(
      ready: (state) => state.data,
      empty: (_) => null,
    );
    yield tagFor(session);
  }
});

const exploreRepositoryPageTtl = Duration(minutes: 2);

/// Whether the provider that owns this keep-alive is still mounted.
///
/// Riverpod 2.6 exposes no public `ref.mounted`, and only `ref.onDispose`
/// throws once the element is gone — `ref.watch` silently attaches to a corpse
/// instead. An `async*` provider that awaits therefore has no way to tell it
/// was disposed mid-build without tracking it itself.
class ExplorePageLifetime {
  ExplorePageLifetime._();

  bool _disposed = false;

  bool get isDisposed => _disposed;
}

/// Keeps an Explorar page provider alive for [exploreRepositoryPageTtl] after
/// its last listener leaves, so paging back and forth does not refetch.
///
/// Must be called before the provider's first `await`: registering the
/// lifecycle callbacks after an async gap throws if the provider was disposed
/// while suspended.
ExplorePageLifetime keepExplorePageAlive(Ref ref) {
  final keepAlive = ref.keepAlive();
  final lifetime = ExplorePageLifetime._();
  Timer? disposeTimer;

  ref.onCancel(() {
    disposeTimer = Timer(exploreRepositoryPageTtl, keepAlive.close);
  });
  ref.onResume(() {
    disposeTimer?.cancel();
    disposeTimer = null;
  });
  ref.onDispose(() {
    lifetime._disposed = true;
    disposeTimer?.cancel();
  });

  return lifetime;
}

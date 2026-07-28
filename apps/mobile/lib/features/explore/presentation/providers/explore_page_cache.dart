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

void keepExplorePageAlive(Ref ref) {
  final keepAlive = ref.keepAlive();
  Timer? disposeTimer;

  ref.onCancel(() {
    disposeTimer = Timer(exploreRepositoryPageTtl, keepAlive.close);
  });
  ref.onResume(() {
    disposeTimer?.cancel();
    disposeTimer = null;
  });
  ref.onDispose(() => disposeTimer?.cancel());
}

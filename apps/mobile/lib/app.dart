import 'dart:async';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/session/session_listenable.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/router/app_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AtlasMedApp extends ConsumerStatefulWidget {
  const AtlasMedApp({super.key});

  @override
  ConsumerState<AtlasMedApp> createState() => _AtlasMedAppState();
}

class _AtlasMedAppState extends ConsumerState<AtlasMedApp>
    with WidgetsBindingObserver {
  late final GoRouter _router;
  late final SessionListenable _sessionListenable;
  ProviderSubscription<LocationSessionState>? _locationSub;
  VoidCallback? _authWatchListener;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final sessionEnvironment = ref.read(sessionProvider);
    _sessionListenable = SessionListenable(sessionEnvironment);
    _router = createAppRouter(sessionListenable: _sessionListenable, ref: ref);
    _locationSub = ref.listenManual<LocationSessionState>(
      locationSessionProvider,
      (_, _) => _router.refresh(),
    );
    _authWatchListener = _syncLocationWatching;
    _sessionListenable.addListener(_authWatchListener!);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(avatarControllerProvider.notifier).recoverLostData();
      _syncLocationWatching();
    });
  }

  void _syncLocationWatching() {
    final notifier = ref.read(locationSessionProvider.notifier);
    if (_sessionListenable.isAuthenticated) {
      notifier.startWatching();
      unawaited(notifier.ensureLocation());
    } else {
      notifier.stopWatching();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (_authWatchListener != null) {
      _sessionListenable.removeListener(_authWatchListener!);
    }
    _locationSub?.close();
    _sessionListenable.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_sessionListenable.isAuthenticated ||
        state != AppLifecycleState.resumed) {
      return;
    }
    final notifier = ref.read(locationSessionProvider.notifier);
    unawaited(() async {
      await notifier.revalidate();
      if (ref.read(locationSessionProvider).isUsable) {
        await notifier.ensureLocation();
      }
    }());
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'AtlasMed',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    themeMode: ThemeMode.light,
    routerConfig: _router,
  );
}

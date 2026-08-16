import 'dart:async';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/session/session_listenable.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/router/app_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:device_preview/device_preview.dart';
import 'package:flutter/foundation.dart';
import 'package:atlasmed_mobile_app/core/session/user_activity.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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
    if (!_sessionListenable.isAuthenticated) {
      notifier.stopWatching();
      return;
    }
    notifier.startWatching();
    if (kIsWeb &&
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
      // Avoid issuing the geolocation prompt while the tab is not focused —
      // Chrome suppresses/queues it silently. The resumed lifecycle handler
      // or the location gate prompts once the tab regains focus.
      return;
    }
    unawaited(notifier.ensureLocation());
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
    // Spec 0015 §4.1: requests made while the app is not on screen are the
    // token timer's, not a person's, and must not count as activity.
    UserActivity.instance.setForeground(state == AppLifecycleState.resumed);

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
    // The app has always been pt-BR, but never said so to Material: every
    // date picker opened in English on US date order.
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('pt', 'BR')],
    // Device Preview: no web (ver main.dart) o app é envolvido no
    // DevicePreview; aqui conectamos locale e builder para que o dispositivo
    // simulado (MediaQuery) seja aplicado. Em plataformas nativas nada muda.
    locale: kIsWeb ? DevicePreview.locale(context) : null,
    builder: (context, child) {
      final devicePreviewed = kIsWeb
          ? DevicePreview.appBuilder(context, child)
          : child ?? const SizedBox.shrink();
      // Wraps everything so a touch anywhere counts, including inside the
      // router's own pages.
      return UserActivityTracker(child: devicePreviewed);
    },
  );
}

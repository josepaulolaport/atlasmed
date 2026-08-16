import 'package:atlasmed_mobile_app/core/navigation/app_route_observer.dart';
import 'package:atlasmed_mobile_app/core/session/session_listenable.dart';
import 'package:atlasmed_mobile_app/core/user/role_capabilities.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/router/root_navigator_key.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

GoRouter createAppRouter({
  required SessionListenable sessionListenable,
  required WidgetRef ref,
}) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/splash',
    observers: [appRouteObserver],
    refreshListenable: sessionListenable,
    routes: $appRoutes,
    redirect: (_, state) {
      final isAuthenticated = sessionListenable.isAuthenticated;
      final location = state.matchedLocation;
      final isSplash = location.startsWith('/splash');
      final isLocationGate = location == '/location-gate';

      if (isAuthenticated) {
        final user = ref.read(currentUserProvider).valueOrNull;
        // Only a rep has an agenda of their own. A manager reaching /agenda
        // directly — an old deep link, a bookmark — lands on the dashboard
        // rather than an empty calendar; theirs is reached per rep from Equipe.
        if (location == '/agenda' &&
            user != null &&
            !canReadOwnAgenda(user.role.name)) {
          return '/dashboard';
        }
        final locationSession = ref.read(locationSessionProvider);
        if (!locationSession.isUsable) {
          return isLocationGate ? null : '/location-gate';
        }
        return (isSplash || isLocationGate) ? '/dashboard' : null;
      }
      return isSplash ? null : '/splash';
    },
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/presentation/providers/auth_provider.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/forgot_email_screen.dart';
import 'features/auth/presentation/screens/forgot_code_screen.dart';
import 'features/auth/presentation/screens/forgot_new_password_screen.dart';
import 'features/auth/presentation/screens/forgot_success_screen.dart';
import 'features/auth/presentation/screens/login_success_screen.dart';
import 'features/explore/presentation/screens/clinic_detail_screen.dart';
import 'features/explore/presentation/screens/explore_screen.dart';
import 'shared/theme/app_theme.dart';

/// Notifies GoRouter to re-evaluate redirects when auth state changes.
class _RouterRefreshNotifier extends ChangeNotifier {
  void requestRefresh() => notifyListeners();
}

class AtlasMedApp extends ConsumerStatefulWidget {
  const AtlasMedApp({super.key});

  @override
  ConsumerState<AtlasMedApp> createState() => _AtlasMedAppState();
}

class _AtlasMedAppState extends ConsumerState<AtlasMedApp> {
  late final GoRouter _router;
  final _routerRefreshNotifier = _RouterRefreshNotifier();

  @override
  void initState() {
    super.initState();
    _router = _buildRouter();

    // Check stored session on app start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).checkSession();
    });
  }

  @override
  void dispose() {
    _routerRefreshNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Listen to auth changes inside build() — ref.listen only allowed here
    ref.listen<AuthState>(authProvider, (_, next) {
      if (next.status == AuthStatus.authenticated ||
          next.status == AuthStatus.unauthenticated) {
        _routerRefreshNotifier.requestRefresh();
      }
    });

    return MaterialApp.router(
      title: 'AtlasMed',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: _router,
    );
  }

  GoRouter _buildRouter() {
    return GoRouter(
      initialLocation: '/splash',
      refreshListenable: _routerRefreshNotifier,
      redirect: (context, state) {
        final auth = ref.read(authProvider);

        // While on splash/unknown, allow splash to play
        if (auth.status == AuthStatus.unknown) return null;

        final location = state.matchedLocation;
        final isAuthRoute = location.startsWith('/auth');
        final isSplash = location == '/splash';

        if (auth.status == AuthStatus.authenticated) {
          if (isSplash || isAuthRoute) {
            return '/workspace';
          }
          return null;
        }

        // Not authenticated — only allow auth routes and splash
        if (!isSplash && !isAuthRoute) {
          return '/splash';
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/splash',
          builder: (_, __) => SplashScreen(
            onDone: () {}, // GoRouter redirect handles navigation
          ),
          routes: [
            // Auth flow routes
            GoRoute(
              path: 'login',
              builder: (_, __) => LoginScreen(
                onForgotPassword: () => context.push('/splash/login/forgot'),
                onLoginSuccess: () => context.go('/workspace'),
              ),
              routes: [
                GoRoute(
                  path: 'forgot',
                  builder: (_, __) => ForgotEmailScreen(
                    onBack: () => context.pop(),
                    onCodeSent: () => context.push('/splash/login/forgot/code'),
                  ),
                  routes: [
                    GoRoute(
                      path: 'code',
                      builder: (_, __) => ForgotCodeScreen(
                        onBack: () => context.pop(),
                        onCodeVerified: () =>
                            context.push('/splash/login/forgot/new-password'),
                      ),
                    ),
                    GoRoute(
                      path: 'new-password',
                      builder: (_, __) => ForgotNewPasswordScreen(
                        onBack: () => context.pop(),
                        onSuccess: () =>
                            context.pushReplacement('/splash/login/forgot/success'),
                      ),
                    ),
                    GoRoute(
                      path: 'success',
                      builder: (_, __) => ForgotSuccessScreen(
                        onBackToLogin: () => context.go('/splash/login'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        GoRoute(
          path: '/login-success',
          builder: (_, __) {
            final auth = ref.read(authProvider);
            return LoginSuccessScreen(
              displayName: auth.session?.userDisplayName ?? 'Rafael',
            );
          },
        ),
        // Explore screen — clinic/doctor list
        GoRoute(
          path: '/workspace',
          builder: (_, __) => const ExploreScreen(),
          routes: [
            GoRoute(
              path: 'clinic/:id',
              builder: (_, state) => ClinicDetailScreen(
                clinicId: state.pathParameters['id']!,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

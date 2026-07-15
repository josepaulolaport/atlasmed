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
import 'features/dashboard/presentation/screens/dashboard_screen.dart';
import 'features/explore/presentation/screens/clinic_detail_screen.dart';
import 'features/explore/presentation/screens/doctor_detail_screen.dart';
import 'features/explore/presentation/screens/explore_screen.dart';
import 'features/map/presentation/screens/map_screen.dart';
import 'features/orders/presentation/screens/meus_orders_screen.dart';
import 'features/orders/presentation/screens/order_detail_screen.dart';
import 'features/orders/presentation/screens/order_tracking_screen.dart';
import 'features/orders/presentation/screens/new_order_products_screen.dart';
import 'features/orders/presentation/screens/cart_screen.dart';
import 'features/orders/presentation/screens/checkout_screen.dart';
import 'features/orders/presentation/screens/order_success_screen.dart';
import 'features/presentations/presentation/screens/presentations_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'shared/theme/app_theme.dart';
import 'shared/widgets/app_shell.dart';
import 'core/repositories/session_environment.dart';
import 'core/repositories/session_listenable.dart';

class AtlasMedApp extends ConsumerStatefulWidget {
  const AtlasMedApp({super.key});

  @override
  ConsumerState<AtlasMedApp> createState() => _AtlasMedAppState();
}

class _AtlasMedAppState extends ConsumerState<AtlasMedApp> {
  late final GoRouter _router;
  late final SessionListenable _sessionListenable;

  @override
  void initState() {
    super.initState();
    _sessionListenable = SessionListenable();
    _router = _buildRouter();
  }

  @override
  void dispose() {
    _sessionListenable.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
      refreshListenable: _sessionListenable,
      redirect: (context, state) {
        final isAuthenticated = _sessionListenable.isAuthenticated;

        final location = state.matchedLocation;
        final isSplash = location.startsWith('/splash');

        if (isAuthenticated) {
          if (isSplash) return '/workspace';
          return null;
        }

        if (!isSplash) return '/splash';
        return null;
      },
      routes: [
        GoRoute(
          path: '/splash',
          builder: (gc, _) => SplashScreen(
            onDone: () {
              if (_sessionListenable.isAuthenticated) {
                gc.go('/workspace');
              } else {
                gc.go('/splash/login');
              }
            },
          ),
          routes: [
            // Auth flow routes
            GoRoute(
              path: 'login',
              builder: (gc, _) => LoginScreen(
                onForgotPassword: () => gc.push('/splash/login/forgot'),
                onLoginSuccess: () => gc.go('/workspace'),
              ),
              routes: [
                GoRoute(
                  path: 'forgot',
                  builder: (gc, _) => ForgotEmailScreen(
                    onBack: () => gc.pop(),
                    onCodeSent: () => gc.push('/splash/login/forgot/code'),
                  ),
                  routes: [
                    GoRoute(
                      path: 'code',
                      builder: (gc, _) => ForgotCodeScreen(
                        onBack: () => gc.pop(),
                        onCodeVerified: () =>
                            gc.push('/splash/login/forgot/new-password'),
                      ),
                    ),
                    GoRoute(
                      path: 'new-password',
                      builder: (gc, _) => ForgotNewPasswordScreen(
                        onBack: () => gc.pop(),
                        onSuccess: () =>
                            gc.pushReplacement('/splash/login/forgot/success'),
                      ),
                    ),
                    GoRoute(
                      path: 'success',
                      builder: (gc, _) => ForgotSuccessScreen(
                        onBackToLogin: () => gc.go('/splash/login'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        // Authenticated shell — shared drawer across all main sections
        ShellRoute(
          builder: (_, _, child) => AppShellScreen(child: child),
          routes: [
            // Desempenho
            GoRoute(path: '/bi', builder: (_, _) => const DashboardScreen()),
            // Explorar (with clinic/doctor detail sub-routes)
            GoRoute(
              path: '/workspace',
              builder: (_, _) => const ExploreScreen(),
              routes: [
                GoRoute(
                  path: 'clinic/:id',
                  builder: (_, state) =>
                      ClinicDetailScreen(clinicId: state.pathParameters['id']!),
                ),
                GoRoute(
                  path: 'doctor/:id',
                  builder: (_, state) =>
                      DoctorDetailScreen(doctorId: state.pathParameters['id']!),
                ),
              ],
            ),
            // Mapa
            GoRoute(path: '/mapa', builder: (_, _) => const MapScreen()),
            // Pedidos
            GoRoute(
              path: '/pedidos',
              builder: (_, _) => const MeusOrdersScreen(),
              routes: [
                GoRoute(
                  path: 'novo',
                  builder: (_, _) => const NewOrderProductsScreen(),
                  routes: [
                    GoRoute(
                      path: 'carrinho',
                      builder: (_, _) => const CartScreen(),
                    ),
                    GoRoute(
                      path: 'checkout',
                      builder: (_, _) => const CheckoutScreen(),
                    ),
                    GoRoute(
                      path: 'sucesso',
                      builder: (_, _) => const OrderSuccessScreen(),
                    ),
                  ],
                ),
                GoRoute(
                  path: ':id',
                  builder: (_, state) =>
                      OrderDetailScreen(orderId: state.pathParameters['id']!),
                  routes: [
                    GoRoute(
                      path: 'rastreio',
                      builder: (_, state) => OrderTrackingScreen(
                        orderId: state.pathParameters['id']!,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            // Apresentações
            GoRoute(
              path: '/apresentacoes',
              builder: (_, _) => const PresentationsScreen(),
            ),
            // Perfil
            GoRoute(path: '/perfil', builder: (_, _) => const ProfileScreen()),
          ],
        ),
      ],
    );
  }
}

import 'dart:async';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/navigation/app_route_observer.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/core/user/role_capabilities.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/splash_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/login_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_email_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_code_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_new_password_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_success_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/register_invite_screen.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/screens/location_gate_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastro_review_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastros_review_list_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidade_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidades_list_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_comparison_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_home_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_price_index_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/potential_definitions_admin_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/products_home_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/purchase_bucket_facilities_screen.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/guards/agenda_route_guards.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/interaction_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/clinic_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/doctor_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/screens/map_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/my_orders_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_tracking_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/new_order_products_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/cart_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/checkout_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/data/repositories/orders_repository.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_success_screen.dart';
import 'package:atlasmed_mobile_app/features/presentations/presentation/screens/presentations_screen.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/screens/profile_screen.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_target.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/screens/territory_editor_screen.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/screens/territories_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/edit_user_assignments_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/edit_user_profile_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invitation_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invitations_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite_user_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/user_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/users_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/core/session/session_listenable.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

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
    _router = _buildRouter();
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

  GoRouter _buildRouter() {
    return GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/splash',
      observers: [appRouteObserver],
      refreshListenable: _sessionListenable,
      redirect: (_, state) {
        final isAuthenticated = _sessionListenable.isAuthenticated;
        final location = state.matchedLocation;
        final isSplash = location.startsWith('/splash');
        final isLocationGate = location == '/location-gate';

        if (isAuthenticated) {
          final user = ref.read(currentUserProvider).valueOrNull;
          if (location == '/agenda' &&
              user != null &&
              !canReadAgenda(user.role.name)) {
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
      routes: [
        GoRoute(
          path: '/location-gate',
          builder: (_, _) => const LocationGateScreen(),
        ),
        GoRoute(
          path: '/splash',
          builder: (context, _) => SplashScreen(
            onDone: () {
              if (_sessionListenable.isAuthenticated) {
                ref.read(locationSessionProvider.notifier).ensureLocation();
                context.go('/location-gate');
              } else {
                context.go('/splash/login');
              }
            },
          ),
          routes: [
            GoRoute(
              path: 'login',
              builder: (context, _) => LoginScreen(
                onForgotPassword: () => context.push('/splash/login/forgot'),
                onRegisterInvite: () => context.push('/splash/login/register'),
                onLoginSuccess: () {
                  ref.read(locationSessionProvider.notifier).ensureLocation();
                  context.go('/location-gate');
                },
              ),
              routes: [
                GoRoute(
                  path: 'register',
                  builder: (context, state) => RegisterInviteScreen(
                    initialToken: state.uri.queryParameters['token'],
                    onBackToLogin: () => context.go('/splash/login'),
                    onRegistered: () {
                      final messenger = ScaffoldMessenger.maybeOf(context);
                      context.go('/splash/login');
                      messenger?.showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Conta criada. Entre com seu e-mail e senha.',
                          ),
                        ),
                      );
                    },
                  ),
                ),
                GoRoute(
                  path: 'forgot',
                  builder: (context, _) => ForgotEmailScreen(
                    onBack: () => context.pop(),
                    onCodeSent: () => context.push('/splash/login/forgot/code'),
                  ),
                  routes: [
                    GoRoute(
                      path: 'code',
                      builder: (context, _) => ForgotCodeScreen(
                        onBack: () => context.pop(),
                        onCodeVerified: () =>
                            context.push('/splash/login/forgot/new-password'),
                      ),
                    ),
                    GoRoute(
                      path: 'new-password',
                      builder: (context, _) => ForgotNewPasswordScreen(
                        onBack: () => context.pop(),
                        onSuccess: () => context.pushReplacement(
                          '/splash/login/forgot/success',
                        ),
                      ),
                    ),
                    GoRoute(
                      path: 'success',
                      builder: (context, _) => ForgotSuccessScreen(
                        onBackToLogin: () => context.go('/splash/login'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        StatefulShellRoute.indexedStack(
          builder: (_, _, navigationShell) =>
              AppShellScreen(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/dashboard',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: DashboardScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/explore',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: ExploreScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/map',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: MapScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/agenda',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: AgendaRouteGuard()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/territories',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: TerritoriesScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/users',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: UsersScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/orders',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: MyOrdersScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/registrations',
                  pageBuilder: (_, _) => const NoTransitionPage(
                    child: CadastrosReviewListScreen(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/non-conformities',
                  pageBuilder: (_, _) => const NoTransitionPage(
                    child: NaoConformidadesListScreen(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/products',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: ProductsHomeScreen()),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  pageBuilder: (_, _) =>
                      const NoTransitionPage(child: ProfileScreen()),
                ),
              ],
            ),
          ],
        ),
        // Details and flows use the root navigator so the drawer cannot capture
        // the edge-swipe back gesture.
        GoRoute(
          path: '/agenda/new',
          builder: (_, state) => AgendaEditorRouteGuard(
            target: CalendarEditorTarget.creating(
              prefill: state.extra is CalendarEditorPrefill
                  ? state.extra as CalendarEditorPrefill
                  : null,
            ),
          ),
        ),
        GoRoute(
          path: '/agenda/:id/edit',
          builder: (_, state) {
            final occurrence = state.extra;
            if (occurrence is! CalendarOccurrence) {
              return const Scaffold(
                body: Center(
                  child: Text('Não foi possível abrir este compromisso.'),
                ),
              );
            }
            return AgendaEditorRouteGuard(
              target: CalendarEditorTarget.editingSeries(occurrence),
            );
          },
        ),
        GoRoute(
          path: '/agenda/:id/occurrences/:recurrenceKey/edit',
          builder: (_, state) {
            final occurrence = state.extra;
            if (occurrence is! CalendarOccurrence) {
              return const Scaffold(
                body: Center(
                  child: Text('Não foi possível abrir esta ocorrência.'),
                ),
              );
            }
            return AgendaEditorRouteGuard(
              target: CalendarEditorTarget.editingOccurrence(occurrence),
            );
          },
        ),
        GoRoute(
          path: '/dashboard/facilities/:bucket',
          builder: (_, state) => PurchaseBucketFacilitiesScreen(
            bucket: state.pathParameters['bucket']!,
            verticalId: parseRouteCrmIdOrNull(state.uri.queryParameters['verticalId'], 'verticalId'),
          ),
        ),
        GoRoute(
          path: '/explore/clinic/:id',
          builder: (_, state) => ClinicDetailScreen(
            clinicId: parseRouteCrmId(state.pathParameters['id']!),
            initialVerticalId: parseRouteCrmIdOrNull(state.uri.queryParameters['verticalId'], 'verticalId'),
          ),
        ),
        GoRoute(
          path: '/explore/doctor/:id',
          builder: (_, state) => DoctorDetailScreen(
            doctorId: parseRouteCrmId(state.pathParameters['id']!),
            facilityId: parseRouteCrmIdOrNull(state.uri.queryParameters['facilityId'], 'facilityId'),
          ),
        ),
        GoRoute(
          path: '/agenda/interactions/:id',
          builder: (_, state) => InteractionScreen(
            interactionId: parseRouteCrmId(state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/orders/new',
          builder: (_, state) => NewOrderProductsScreen(
            interactionId: parseRouteCrmIdOrNull(
              state.uri.queryParameters['interactionId'],
              'interactionId',
            ),
            facilityId: parseRouteCrmIdOrNull(
              state.uri.queryParameters['facilityId'],
              'facilityId',
            ),
            facilityName: state.uri.queryParameters['facilityName'],
          ),
        ),
        GoRoute(
          path: '/orders/new/cart',
          builder: (_, _) => const CartScreen(),
        ),
        GoRoute(
          path: '/orders/new/checkout',
          builder: (_, _) => const CheckoutScreen(),
        ),
        GoRoute(
          path: '/orders/new/success',
          builder: (_, state) {
            final order = state.extra;
            if (order is! ApiOrderDetail) {
              return const Scaffold(
                body: Center(
                  child: Text(
                    'Não foi possível abrir a confirmação do pedido.',
                  ),
                ),
              );
            }
            return const OrderSuccessScreen();
          },
        ),
        GoRoute(
          path: '/orders/:id',
          builder: (_, state) =>
              OrderDetailScreen(orderId: parseRouteCrmId(state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/orders/:id/tracking',
          builder: (_, state) =>
              OrderTrackingScreen(orderId: parseRouteCrmId(state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/registrations/:id',
          builder: (_, state) => CadastroReviewDetailScreen(
            submissionId: parseRouteCrmId(state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/non-conformities/:id',
          builder: (_, state) => NaoConformidadeDetailScreen(
            suggestionId: parseRouteCrmId(state.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/products/:familyId',
          builder: (_, state) =>
              ProductDetailScreen(familyId: parseRouteCrmId(state.pathParameters['familyId']!, 'familyId')),
        ),
        GoRoute(
          path: '/users/invite',
          builder: (_, _) => const InviteUserScreen(),
        ),
        GoRoute(
          path: '/users/invitations',
          builder: (_, _) => const InvitationsScreen(),
        ),
        GoRoute(
          path: '/users/invitations/:invitationId',
          builder: (_, state) => InvitationDetailScreen(
            invitationId: parseRouteCrmId(
              state.pathParameters['invitationId']!,
              'invitationId',
            ),
          ),
        ),
        GoRoute(
          path: '/users/invitations/:invitationId/edit',
          builder: (_, state) => InviteUserScreen(
            invitationId: state.pathParameters['invitationId'] != null ? parseRouteCrmId(state.pathParameters['invitationId']!, 'invitationId') : null,
          ),
        ),
        GoRoute(
          path: '/users/:id',
          builder: (_, state) =>
              UserDetailScreen(userId: parseRouteCrmId(state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/users/:id/edit',
          builder: (_, state) =>
              EditUserProfileScreen(userId: parseRouteCrmId(state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/users/:id/assignments',
          builder: (_, state) =>
              EditUserAssignmentsScreen(userId: parseRouteCrmId(state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/territories/:id/edit',
          builder: (_, state) => TerritoryEditorScreen(
            target: TerritoryEditorTarget.existing(parseRouteCrmId(state.pathParameters['id']!)),
          ),
        ),
        GoRoute(
          path: '/territories/create',
          builder: (_, state) => TerritoryEditorScreen(
            target: state.extra is TerritoryEditorTarget
                ? state.extra as TerritoryEditorTarget
                : const TerritoryEditorTarget.creating(
                    initialKind: TerritoryKind.managerZone,
                  ),
          ),
        ),
        // pt-BR alias (same builder — redirect would drop `extra`).
        GoRoute(
          path: '/territories/criar',
          builder: (_, state) => TerritoryEditorScreen(
            target: state.extra is TerritoryEditorTarget
                ? state.extra as TerritoryEditorTarget
                : const TerritoryEditorTarget.creating(
                    initialKind: TerritoryKind.managerZone,
                  ),
          ),
        ),
        GoRoute(path: '/catalog', builder: (_, _) => const CatalogHomeScreen()),
        GoRoute(
          path: '/catalog/potential-definitions',
          builder: (_, _) => const PotentialDefinitionsAdminScreen(),
        ),
        GoRoute(
          path: '/catalog/price-index',
          builder: (_, _) => const CatalogPriceIndexScreen(),
        ),
        GoRoute(
          path: '/catalog/comparison/:variantId',
          builder: (_, state) => CatalogComparisonScreen(
            variantId: parseRouteCrmId(state.pathParameters['variantId']!, 'variantId'),
          ),
        ),
        GoRoute(
          path: '/presentations',
          builder: (_, _) => const PresentationsScreen(),
        ),
      ],
    );
  }
}

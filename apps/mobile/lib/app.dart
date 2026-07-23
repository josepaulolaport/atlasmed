import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/navigation/app_route_observer.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/splash_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/login_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_email_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_code_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_new_password_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_success_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/register_invite_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastro_review_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastros_review_list_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidade_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidades_list_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_comparison_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_home_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_price_index_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/products_home_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/dashboard_screen.dart';
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
    final sessionEnvironment = ref.read(sessionProvider);
    _sessionListenable = SessionListenable(sessionEnvironment);
    _router = _buildRouter();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(avatarControllerProvider.notifier).recoverLostData();
    });
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
      observers: [appRouteObserver],
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
                onRegisterInvite: () => gc.push('/splash/login/register'),
                onLoginSuccess: () => gc.go('/workspace'),
              ),
              routes: [
                GoRoute(
                  path: 'register',
                  builder: (gc, state) => RegisterInviteScreen(
                    initialToken: state.uri.queryParameters['token'],
                    onBackToLogin: () => gc.go('/splash/login'),
                    onRegistered: () {
                      final messenger = ScaffoldMessenger.maybeOf(gc);
                      gc.go('/splash/login');
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
            GoRoute(
              path: '/bi',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: DashboardScreen()),
            ),
            // Explorar (with clinic/doctor detail sub-routes)
            GoRoute(
              path: '/workspace',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: ExploreScreen()),
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
            GoRoute(
              path: '/mapa',
              pageBuilder: (_, _) => const NoTransitionPage(child: MapScreen()),
            ),
            // Territórios
            GoRoute(
              path: '/territorios',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: TerritoriesScreen()),
            ),
            // Pedidos
            GoRoute(
              path: '/pedidos',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: MyOrdersScreen()),
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
            // Cadastros — ops approval queue for facility registration docs
            GoRoute(
              path: '/cadastros',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: CadastrosReviewListScreen()),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) => CadastroReviewDetailScreen(
                    submissionId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
            // Não Conformidades — field-change suggestions (clinic/doctor)
            GoRoute(
              path: '/nao-conformidades',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: NaoConformidadesListScreen()),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) => NaoConformidadeDetailScreen(
                    suggestionId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
            // Catálogo (current — kept intact while Produtos is redesigned)
            GoRoute(
              path: '/catalogo',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: CatalogHomeScreen()),
              routes: [
                GoRoute(
                  path: 'brasindice',
                  builder: (_, _) => const CatalogPriceIndexScreen(),
                ),
                GoRoute(
                  path: 'comparativo/:variantId',
                  builder: (_, state) => CatalogComparisonScreen(
                    variantId: state.pathParameters['variantId']!,
                  ),
                ),
              ],
            ),
            // Produtos (revamp — build the new experience here)
            GoRoute(
              path: '/produtos',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: ProductsHomeScreen()),
              routes: [
                GoRoute(
                  path: ':familyId',
                  builder: (_, state) => ProductDetailScreen(
                    familyId: state.pathParameters['familyId']!,
                  ),
                ),
              ],
            ),
            // Apresentações
            GoRoute(
              path: '/apresentacoes',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: PresentationsScreen()),
            ),
            // Perfil
            GoRoute(
              path: '/perfil',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: ProfileScreen()),
            ),
            // Usuários (admin-only — see canManageUsersProvider)
            GoRoute(
              path: '/usuarios',
              pageBuilder: (_, _) =>
                  const NoTransitionPage(child: UsersScreen()),
              routes: [
                GoRoute(
                  path: 'convidar',
                  builder: (_, _) => const InviteUserScreen(),
                ),
                GoRoute(
                  path: 'convites',
                  builder: (_, _) => const InvitationsScreen(),
                  routes: [
                    GoRoute(
                      path: ':invitationId',
                      builder: (_, state) => InvitationDetailScreen(
                        invitationId: state.pathParameters['invitationId']!,
                      ),
                      routes: [
                        GoRoute(
                          path: 'editar',
                          builder: (_, state) => InviteUserScreen(
                            invitationId: state.pathParameters['invitationId'],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                GoRoute(
                  path: ':id',
                  builder: (_, state) =>
                      UserDetailScreen(userId: state.pathParameters['id']!),
                  routes: [
                    GoRoute(
                      path: 'editar',
                      builder: (_, state) => EditUserProfileScreen(
                        userId: state.pathParameters['id']!,
                      ),
                    ),
                    GoRoute(
                      path: 'atribuicoes',
                      builder: (_, state) => EditUserAssignmentsScreen(
                        userId: state.pathParameters['id']!,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        // Editor de território — full screen, no shared drawer/shell chrome.
        GoRoute(
          path: '/territorios/:id/editar',
          builder: (_, state) => TerritoryEditorScreen(
            target: TerritoryEditorTarget.existing(state.pathParameters['id']!),
          ),
        ),
        // Criação de território — same full-screen editor, started from
        // an empty boundary; `extra` carries the kind/sector hints from
        // whatever the viewer had filtered to.
        GoRoute(
          path: '/territorios/criar',
          builder: (_, state) => TerritoryEditorScreen(
            target: state.extra is TerritoryEditorTarget
                ? state.extra as TerritoryEditorTarget
                : const TerritoryEditorTarget.creating(
                    initialKind: TerritoryKind.managerZone,
                  ),
          ),
        ),
      ],
    );
  }
}

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/guards/agenda_route_guards.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/interaction_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_code_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_email_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_new_password_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/forgot_success_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/login_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/register_invite_screen.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/screens/splash_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastro_review_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/screens/cadastros_review_list_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_comparison_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_home_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/catalog_price_index_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/potential_definitions_admin_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/products_home_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/facility_drill_down_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/clinic_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/favoritos_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/doctor_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/explore_screen.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/screens/location_gate_screen.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/screens/map_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidade_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidades_list_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/my_orders_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_tracking_screen.dart';
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
import 'package:atlasmed_mobile_app/router/root_navigator_key.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

part 'routes.g.dart';

// ---------------------------------------------------------------------------
// Auth / location
// ---------------------------------------------------------------------------

@TypedGoRoute<LocationGateRoute>(path: '/location-gate')
class LocationGateRoute extends GoRouteData with $LocationGateRoute {
  const LocationGateRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const LocationGateScreen();
}

@TypedGoRoute<SplashRoute>(
  path: '/splash',
  routes: [
    TypedGoRoute<LoginRoute>(
      path: 'login',
      routes: [
        TypedGoRoute<RegisterInviteRoute>(path: 'register'),
        TypedGoRoute<ForgotEmailRoute>(
          path: 'forgot',
          routes: [
            TypedGoRoute<ForgotCodeRoute>(path: 'code'),
            TypedGoRoute<ForgotNewPasswordRoute>(path: 'new-password'),
            TypedGoRoute<ForgotSuccessRoute>(path: 'success'),
          ],
        ),
      ],
    ),
  ],
)
class SplashRoute extends GoRouteData with $SplashRoute {
  const SplashRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return Consumer(
      builder: (context, ref, _) {
        return SplashScreen(
          onDone: () {
            final authenticated =
                ref.read(sessionProvider).currentValue != null;
            if (authenticated) {
              ref.read(locationSessionProvider.notifier).ensureLocation();
              const LocationGateRoute().go(context);
            } else {
              const LoginRoute().go(context);
            }
          },
        );
      },
    );
  }
}

class LoginRoute extends GoRouteData with $LoginRoute {
  const LoginRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return Consumer(
      builder: (context, ref, _) {
        return LoginScreen(
          onForgotPassword: () => const ForgotEmailRoute().push(context),
          onRegisterInvite: () => const RegisterInviteRoute().push(context),
          onLoginSuccess: () {
            ref.read(locationSessionProvider.notifier).ensureLocation();
            const LocationGateRoute().go(context);
          },
        );
      },
    );
  }
}

class RegisterInviteRoute extends GoRouteData with $RegisterInviteRoute {
  const RegisterInviteRoute({this.token});

  final String? token;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return RegisterInviteScreen(
      initialToken: token ?? state.uri.queryParameters['token'],
      onBackToLogin: () => const LoginRoute().go(context),
      onRegistered: () {
        final messenger = ScaffoldMessenger.maybeOf(context);
        const LoginRoute().go(context);
        messenger?.showSnackBar(
          const SnackBar(
            content: Text('Conta criada. Entre com seu e-mail e senha.'),
          ),
        );
      },
    );
  }
}

class ForgotEmailRoute extends GoRouteData with $ForgotEmailRoute {
  const ForgotEmailRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ForgotEmailScreen(
      onBack: () => context.pop(),
      onCodeSent: () => const ForgotCodeRoute().push(context),
    );
  }
}

class ForgotCodeRoute extends GoRouteData with $ForgotCodeRoute {
  const ForgotCodeRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ForgotCodeScreen(
      onBack: () => context.pop(),
      onCodeVerified: () => const ForgotNewPasswordRoute().push(context),
    );
  }
}

class ForgotNewPasswordRoute extends GoRouteData with $ForgotNewPasswordRoute {
  const ForgotNewPasswordRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ForgotNewPasswordScreen(
      onBack: () => context.pop(),
      onSuccess: () => const ForgotSuccessRoute().pushReplacement(context),
    );
  }
}

class ForgotSuccessRoute extends GoRouteData with $ForgotSuccessRoute {
  const ForgotSuccessRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ForgotSuccessScreen(
      onBackToLogin: () => const LoginRoute().go(context),
    );
  }
}

// ---------------------------------------------------------------------------
// Shell tabs
// ---------------------------------------------------------------------------

@TypedStatefulShellRoute<AppShellRoute>(
  branches: <TypedStatefulShellBranch<StatefulShellBranchData>>[
    TypedStatefulShellBranch<DashboardBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<DashboardRoute>(path: '/dashboard'),
      ],
    ),
    TypedStatefulShellBranch<ExploreBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<ExploreRoute>(path: '/explore'),
      ],
    ),
    TypedStatefulShellBranch<MapBranch>(
      routes: <TypedRoute<RouteData>>[TypedGoRoute<MapRoute>(path: '/map')],
    ),
    TypedStatefulShellBranch<AgendaBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<AgendaRoute>(path: '/agenda'),
      ],
    ),
    TypedStatefulShellBranch<TerritoriesBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<TerritoriesRoute>(path: '/territories'),
      ],
    ),
    TypedStatefulShellBranch<UsersBranch>(
      routes: <TypedRoute<RouteData>>[TypedGoRoute<UsersRoute>(path: '/users')],
    ),
    TypedStatefulShellBranch<OrdersBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<OrdersRoute>(path: '/orders'),
      ],
    ),
    TypedStatefulShellBranch<RegistrationsBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<RegistrationsRoute>(path: '/registrations'),
      ],
    ),
    TypedStatefulShellBranch<NonConformitiesBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<NonConformitiesRoute>(path: '/non-conformities'),
      ],
    ),
    TypedStatefulShellBranch<ProductsBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<ProductsRoute>(path: '/products'),
      ],
    ),
    TypedStatefulShellBranch<ProfileBranch>(
      routes: <TypedRoute<RouteData>>[
        TypedGoRoute<ProfileRoute>(path: '/profile'),
      ],
    ),
  ],
)
class AppShellRoute extends StatefulShellRouteData {
  const AppShellRoute();

  @override
  Widget builder(
    BuildContext context,
    GoRouterState state,
    StatefulNavigationShell navigationShell,
  ) {
    return AppShellScreen(navigationShell: navigationShell);
  }
}

class DashboardBranch extends StatefulShellBranchData {
  const DashboardBranch();
}

class ExploreBranch extends StatefulShellBranchData {
  const ExploreBranch();
}

class MapBranch extends StatefulShellBranchData {
  const MapBranch();
}

class AgendaBranch extends StatefulShellBranchData {
  const AgendaBranch();
}

class TerritoriesBranch extends StatefulShellBranchData {
  const TerritoriesBranch();
}

class UsersBranch extends StatefulShellBranchData {
  const UsersBranch();
}

class OrdersBranch extends StatefulShellBranchData {
  const OrdersBranch();
}

class RegistrationsBranch extends StatefulShellBranchData {
  const RegistrationsBranch();
}

class NonConformitiesBranch extends StatefulShellBranchData {
  const NonConformitiesBranch();
}

class ProductsBranch extends StatefulShellBranchData {
  const ProductsBranch();
}

class ProfileBranch extends StatefulShellBranchData {
  const ProfileBranch();
}

class DashboardRoute extends GoRouteData with $DashboardRoute {
  const DashboardRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: DashboardScreen());
}

class ExploreRoute extends GoRouteData with $ExploreRoute {
  const ExploreRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: ExploreScreen());
}

class MapRoute extends GoRouteData with $MapRoute {
  const MapRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: MapScreen());
}

class AgendaRoute extends GoRouteData with $AgendaRoute {
  const AgendaRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: AgendaRouteGuard());
}

class TerritoriesRoute extends GoRouteData with $TerritoriesRoute {
  const TerritoriesRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: TerritoriesScreen());
}

class UsersRoute extends GoRouteData with $UsersRoute {
  const UsersRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: UsersScreen());
}

class OrdersRoute extends GoRouteData with $OrdersRoute {
  const OrdersRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: MyOrdersScreen());
}

class RegistrationsRoute extends GoRouteData with $RegistrationsRoute {
  const RegistrationsRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: CadastrosReviewListScreen());
}

class NonConformitiesRoute extends GoRouteData with $NonConformitiesRoute {
  const NonConformitiesRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: NaoConformidadesListScreen());
}

class ProductsRoute extends GoRouteData with $ProductsRoute {
  const ProductsRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: ProductsHomeScreen());
}

class ProfileRoute extends GoRouteData with $ProfileRoute {
  const ProfileRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: ProfileScreen());
}

// ---------------------------------------------------------------------------
// Detail / flow routes (root navigator)
// ---------------------------------------------------------------------------

@TypedGoRoute<AgendaNewRoute>(path: '/agenda/new')
class AgendaNewRoute extends GoRouteData with $AgendaNewRoute {
  const AgendaNewRoute({this.$extra});

  final CalendarEditorPrefill? $extra;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return AgendaEditorRouteGuard(
      target: CalendarEditorTarget.creating(prefill: $extra),
    );
  }
}

@TypedGoRoute<AgendaEditRoute>(path: '/agenda/:id/edit')
class AgendaEditRoute extends GoRouteData with $AgendaEditRoute {
  const AgendaEditRoute({required this.id, this.$extra});

  final int id;
  final CalendarOccurrence? $extra;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    final occurrence = $extra;
    if (occurrence == null) {
      return const Scaffold(
        body: Center(child: Text('Não foi possível abrir este compromisso.')),
      );
    }
    return AgendaEditorRouteGuard(
      target: CalendarEditorTarget.editingSeries(occurrence),
    );
  }
}

@TypedGoRoute<AgendaOccurrenceEditRoute>(
  path: '/agenda/:id/occurrences/:recurrenceKey/edit',
)
class AgendaOccurrenceEditRoute extends GoRouteData
    with $AgendaOccurrenceEditRoute {
  const AgendaOccurrenceEditRoute({
    required this.id,
    required this.recurrenceKey,
    this.$extra,
  });

  final int id;
  final String recurrenceKey;
  final CalendarOccurrence? $extra;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    final occurrence = $extra;
    if (occurrence == null) {
      return const Scaffold(
        body: Center(child: Text('Não foi possível abrir esta ocorrência.')),
      );
    }
    return AgendaEditorRouteGuard(
      target: CalendarEditorTarget.editingOccurrence(occurrence),
    );
  }
}

@TypedGoRoute<PurchaseBucketFacilitiesRoute>(
  path: '/dashboard/facilities/:bucket',
)
class PurchaseBucketFacilitiesRoute extends GoRouteData
    with $PurchaseBucketFacilitiesRoute {
  const PurchaseBucketFacilitiesRoute({
    required this.bucket,
    @TypedQueryParameter(name: 'verticalId') this.verticalId,
  });

  final String bucket;
  final int? verticalId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return FacilityDrillDownScreen(bucket: bucket, verticalId: verticalId);
  }
}

/// Clinics whose CPF is missing or invalid, opened from the Desempenho warning.
///
/// Its own route rather than a query parameter on the bucket one: the two are
/// different slices, and a bucket path segment carrying a CPF status would be
/// a lie in every deep link and analytics event.
@TypedGoRoute<CpfIssueFacilitiesRoute>(path: '/dashboard/cpf-issues/:cpfStatus')
class CpfIssueFacilitiesRoute extends GoRouteData
    with $CpfIssueFacilitiesRoute {
  const CpfIssueFacilitiesRoute({
    required this.cpfStatus,
    @TypedQueryParameter(name: 'verticalId') this.verticalId,
  });

  /// `missing` | `invalid`.
  final String cpfStatus;
  final int? verticalId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return FacilityDrillDownScreen(
      cpfStatus: cpfStatus,
      title: cpfStatus == 'invalid' ? 'CPF inválido' : 'Sem CPF cadastrado',
      verticalId: verticalId,
    );
  }
}

@TypedGoRoute<FavoritosRoute>(path: '/explore/favoritos')
class FavoritosRoute extends GoRouteData with $FavoritosRoute {
  const FavoritosRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return const FavoritosScreen();
  }
}

@TypedGoRoute<ClinicDetailRoute>(path: '/explore/clinic/:id')
class ClinicDetailRoute extends GoRouteData with $ClinicDetailRoute {
  const ClinicDetailRoute({
    required this.id,
    @TypedQueryParameter(name: 'verticalId') this.verticalId,
  });

  final int id;
  final int? verticalId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ClinicDetailScreen(clinicId: id, initialVerticalId: verticalId);
  }
}

@TypedGoRoute<DoctorDetailRoute>(path: '/explore/doctor/:id')
class DoctorDetailRoute extends GoRouteData with $DoctorDetailRoute {
  const DoctorDetailRoute({
    required this.id,
    @TypedQueryParameter(name: 'facilityId') this.facilityId,
  });

  final int id;
  final int? facilityId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return DoctorDetailScreen(doctorId: id, facilityId: facilityId);
  }
}

@TypedGoRoute<InteractionDetailRoute>(path: '/agenda/interactions/:id')
class InteractionDetailRoute extends GoRouteData with $InteractionDetailRoute {
  const InteractionDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return InteractionScreen(interactionId: id);
  }
}

/*
 * Creating an order has no route.
 *
 * `/orders/new`, `/orders/new/cart`, `/orders/new/checkout` and
 * `/orders/new/success` are withdrawn, not merely unreachable from the UI: an
 * order is meant to belong to an interaction and that is not modelled yet, and
 * checkout could never be completed anyway — it asks for a clinic plus an
 * interaction or a doctor, and both of its pickers are stubs over empty lists.
 *
 * The screens behind them, the cart provider and the product order sheet are
 * removed with them rather than left unreachable. Recover them from git when
 * order-interactions are built.
 *
 * Reading orders is unaffected — see OrdersRoute and OrderDetailRoute below.
 */

@TypedGoRoute<OrderDetailRoute>(
  path: '/orders/:id',
  routes: [TypedGoRoute<OrderTrackingRoute>(path: 'tracking')],
)
class OrderDetailRoute extends GoRouteData with $OrderDetailRoute {
  const OrderDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return OrderDetailScreen(orderId: id);
  }
}

class OrderTrackingRoute extends GoRouteData with $OrderTrackingRoute {
  const OrderTrackingRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return OrderTrackingScreen(orderId: id);
  }
}

@TypedGoRoute<RegistrationDetailRoute>(path: '/registrations/:id')
class RegistrationDetailRoute extends GoRouteData
    with $RegistrationDetailRoute {
  const RegistrationDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return CadastroReviewDetailScreen(submissionId: id);
  }
}

@TypedGoRoute<NonConformityDetailRoute>(path: '/non-conformities/:id')
class NonConformityDetailRoute extends GoRouteData
    with $NonConformityDetailRoute {
  const NonConformityDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return NaoConformidadeDetailScreen(suggestionId: id);
  }
}

@TypedGoRoute<ProductDetailRoute>(path: '/products/:familyId')
class ProductDetailRoute extends GoRouteData with $ProductDetailRoute {
  const ProductDetailRoute({required this.familyId});

  final int familyId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return ProductDetailScreen(familyId: familyId);
  }
}

@TypedGoRoute<InviteUserRoute>(path: '/users/invite')
class InviteUserRoute extends GoRouteData with $InviteUserRoute {
  const InviteUserRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const InviteUserScreen();
}

@TypedGoRoute<InvitationsRoute>(
  path: '/users/invitations',
  routes: [
    TypedGoRoute<InvitationDetailRoute>(
      path: ':invitationId',
      routes: [TypedGoRoute<InvitationEditRoute>(path: 'edit')],
    ),
  ],
)
class InvitationsRoute extends GoRouteData with $InvitationsRoute {
  const InvitationsRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const InvitationsScreen();
}

class InvitationDetailRoute extends GoRouteData with $InvitationDetailRoute {
  const InvitationDetailRoute({required this.invitationId});

  final int invitationId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return InvitationDetailScreen(invitationId: invitationId);
  }
}

class InvitationEditRoute extends GoRouteData with $InvitationEditRoute {
  const InvitationEditRoute({required this.invitationId});

  final int invitationId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return InviteUserScreen(invitationId: invitationId);
  }
}

@TypedGoRoute<UserDetailRoute>(
  path: '/users/:id',
  routes: [
    TypedGoRoute<UserEditRoute>(path: 'edit'),
    TypedGoRoute<UserAssignmentsRoute>(path: 'assignments'),
  ],
)
class UserDetailRoute extends GoRouteData with $UserDetailRoute {
  const UserDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return UserDetailScreen(userId: id);
  }
}

class UserEditRoute extends GoRouteData with $UserEditRoute {
  const UserEditRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return EditUserProfileScreen(userId: id);
  }
}

class UserAssignmentsRoute extends GoRouteData with $UserAssignmentsRoute {
  const UserAssignmentsRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return EditUserAssignmentsScreen(userId: id);
  }
}

@TypedGoRoute<TerritoryEditRoute>(path: '/territories/:id/edit')
class TerritoryEditRoute extends GoRouteData with $TerritoryEditRoute {
  const TerritoryEditRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return TerritoryEditorScreen(target: TerritoryEditorTarget.existing(id));
  }
}

@TypedGoRoute<TerritoryCreateRoute>(path: '/territories/create')
class TerritoryCreateRoute extends GoRouteData with $TerritoryCreateRoute {
  const TerritoryCreateRoute({this.$extra});

  final TerritoryEditorTarget? $extra;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return TerritoryEditorScreen(
      target:
          $extra ??
          const TerritoryEditorTarget.creating(
            initialKind: TerritoryKind.managerZone,
          ),
    );
  }
}

/// pt-BR alias (same builder — redirect would drop `extra`).
@TypedGoRoute<TerritoryCreatePtRoute>(path: '/territories/criar')
class TerritoryCreatePtRoute extends GoRouteData with $TerritoryCreatePtRoute {
  const TerritoryCreatePtRoute({this.$extra});

  final TerritoryEditorTarget? $extra;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return TerritoryEditorScreen(
      target:
          $extra ??
          const TerritoryEditorTarget.creating(
            initialKind: TerritoryKind.managerZone,
          ),
    );
  }
}

@TypedGoRoute<CatalogHomeRoute>(
  path: '/catalog',
  routes: [
    TypedGoRoute<CatalogPotentialDefinitionsRoute>(
      path: 'potential-definitions',
    ),
    TypedGoRoute<CatalogPriceIndexRoute>(path: 'price-index'),
    TypedGoRoute<CatalogComparisonRoute>(path: 'comparison/:variantId'),
  ],
)
class CatalogHomeRoute extends GoRouteData with $CatalogHomeRoute {
  const CatalogHomeRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const CatalogHomeScreen();
}

class CatalogPotentialDefinitionsRoute extends GoRouteData
    with $CatalogPotentialDefinitionsRoute {
  const CatalogPotentialDefinitionsRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const PotentialDefinitionsAdminScreen();
}

class CatalogPriceIndexRoute extends GoRouteData with $CatalogPriceIndexRoute {
  const CatalogPriceIndexRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const CatalogPriceIndexScreen();
}

class CatalogComparisonRoute extends GoRouteData with $CatalogComparisonRoute {
  const CatalogComparisonRoute({required this.variantId});

  final int variantId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return CatalogComparisonScreen(variantId: variantId);
  }
}

@TypedGoRoute<PresentationsRoute>(path: '/presentations')
class PresentationsRoute extends GoRouteData with $PresentationsRoute {
  const PresentationsRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const PresentationsScreen();
}

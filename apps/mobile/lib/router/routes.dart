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
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/member_territory_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/metric_clinics_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/out_of_territory_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/assign_clinic_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/team_member_screen.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/team_screen.dart';
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
    // Appended rather than inserted next to Territórios: a branch's position is
    // its `branchIndex`, so slotting it mid-list would silently renumber every
    // branch after it. Display order lives in `appNavigationItems`.
    TypedStatefulShellBranch<TeamBranch>(
      routes: <TypedRoute<RouteData>>[TypedGoRoute<TeamRoute>(path: '/team')],
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

class TeamBranch extends StatefulShellBranchData {
  const TeamBranch();
}

class DashboardRoute extends GoRouteData with $DashboardRoute {
  const DashboardRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: DashboardScreen());
}

class TeamRoute extends GoRouteData with $TeamRoute {
  const TeamRoute();

  @override
  Page<void> buildPage(BuildContext context, GoRouterState state) =>
      const NoTransitionPage(child: TeamScreen());
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

/// Desempenho scoped to another person (spec 0014 §2, "Ver desempenho").
///
/// The same screen as the `/dashboard` tab — one screen, three entry points,
/// three scopes — pushed over the shell so the viewer keeps their own tab state.
@TypedGoRoute<SubjectDashboardRoute>(path: '/team/member/:subjectUserId')
class SubjectDashboardRoute extends GoRouteData with $SubjectDashboardRoute {
  const SubjectDashboardRoute({
    required this.subjectUserId,
    @TypedQueryParameter(name: 'subjectName') this.subjectName,
    @TypedQueryParameter(name: 'subjectRole') this.subjectRole,
    @TypedQueryParameter(name: 'withinManagerId') this.withinManagerId,
  });

  final int subjectUserId;
  final String? subjectName;

  /// Spec 0015 R2: the manager's team this subject was reached through, so an
  /// admin's drill-down reads the population the roster row showed. A manager's
  /// own constraint is derived server-side from their identity, so this is
  /// never how a manager's scope is decided.
  final int? withinManagerId;

  /// Carried so the screen knows which cards the *subject* may be asked about —
  /// "Clínicas não atribuídas" is a zone question and a rep holds no zones.
  final String? subjectRole;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return DashboardScreen(
      subjectUserId: subjectUserId,
      subjectName: subjectName,
      subjectRole: subjectRole,
      withinManagerId: withinManagerId,
    );
  }
}

/// Giving a rep a clinic (spec 0015 R6) — inside their patch, or anywhere with
/// a reason.
@TypedGoRoute<AssignClinicRoute>(path: '/team/profile/:userId/assign-clinic')
class AssignClinicRoute extends GoRouteData with $AssignClinicRoute {
  const AssignClinicRoute({
    required this.userId,
    @TypedQueryParameter(name: 'memberName') this.memberName,
  });

  final int userId;
  final String? memberName;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return AssignClinicScreen(userId: userId, memberName: memberName);
  }
}

/// A member's territory, full screen (spec 0015 R9/R10).
@TypedGoRoute<MemberTerritoryRoute>(path: '/team/profile/:userId/territory')
class MemberTerritoryRoute extends GoRouteData with $MemberTerritoryRoute {
  const MemberTerritoryRoute({
    required this.userId,
    @TypedQueryParameter(name: 'memberName') this.memberName,
    @TypedQueryParameter(name: 'viaManagerId') this.viaManagerId,
    @TypedQueryParameter(name: 'isRep') this.isRep,
  });

  final int userId;
  final String? memberName;
  final int? viaManagerId;

  /// Decides what "nova área" draws — a patch or a zone.
  final bool? isRep;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return MemberTerritoryScreen(
      userId: userId,
      memberName: memberName,
      viaManagerId: viaManagerId,
      isRep: isRep ?? true,
    );
  }
}

/// Clinics a rep holds outside their patches (spec 0009 R2 / 0015 §4.2).
@TypedGoRoute<OutOfTerritoryRoute>(
  path: '/team/profile/:userId/out-of-territory',
)
class OutOfTerritoryRoute extends GoRouteData with $OutOfTerritoryRoute {
  const OutOfTerritoryRoute({
    required this.userId,
    @TypedQueryParameter(name: 'memberName') this.memberName,
  });

  final int userId;
  final String? memberName;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return OutOfTerritoryScreen(userId: userId, memberName: memberName);
  }
}

/// One person, in full (spec 0015 §4) — what a roster row opens onto.
@TypedGoRoute<TeamMemberProfileRoute>(path: '/team/profile/:userId')
class TeamMemberProfileRoute extends GoRouteData with $TeamMemberProfileRoute {
  const TeamMemberProfileRoute({
    required this.userId,
    @TypedQueryParameter(name: 'memberName') this.memberName,
    @TypedQueryParameter(name: 'viaManagerId') this.viaManagerId,
  });

  final int userId;
  final String? memberName;

  /// The manager whose team this person was reached through (spec 0015 R2).
  /// Only meaningful for an admin — a manager's own scope is derived from their
  /// identity server-side and cannot be widened from here.
  final int? viaManagerId;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return TeamMemberScreen(
      userId: userId,
      memberName: memberName,
      viaManagerId: viaManagerId,
    );
  }
}

/// One manager.s team, from the ADMIN roster (spec 0014 §6).
@TypedGoRoute<TeamMemberRoute>(path: '/team/manager/:managerId')
class TeamMemberRoute extends GoRouteData with $TeamMemberRoute {
  const TeamMemberRoute({
    required this.managerId,
    @TypedQueryParameter(name: 'managerName') this.managerName,
  });

  final int managerId;
  final String? managerName;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return TeamScreen(managerId: managerId, managerName: managerName);
  }
}

@TypedGoRoute<RepsWithoutPatchRoute>(path: '/team/reps-without-patch')
class RepsWithoutPatchRoute extends GoRouteData with $RepsWithoutPatchRoute {
  const RepsWithoutPatchRoute();

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const RepsWithoutPatchScreen();
}

/// A metric card's per-clinic breakdown (spec 0014 §4.1).
///
/// Carries the whole scope in the URL because the breakdown must answer for the
/// same population the card counted — a drill-down that dropped a filter would
/// list clinics the number never included.
@TypedGoRoute<MetricClinicsRoute>(path: '/dashboard/metrics/:metric/clinics')
class MetricClinicsRoute extends GoRouteData with $MetricClinicsRoute {
  const MetricClinicsRoute({
    required this.metric,
    @TypedQueryParameter(name: 'verticalId') required this.verticalId,
    @TypedQueryParameter(name: 'subjectUserId') this.subjectUserId,
    @TypedQueryParameter(name: 'unitTypeIds') this.unitTypeIds,
    @TypedQueryParameter(name: 'managerIds') this.managerIds,
    @TypedQueryParameter(name: 'repIds') this.repIds,
    @TypedQueryParameter(name: 'stateIds') this.stateIds,
    @TypedQueryParameter(name: 'municipalityIds') this.municipalityIds,
    @TypedQueryParameter(name: 'withinManagerId') this.withinManagerId,
    @TypedQueryParameter(name: 'manageForUserId') this.manageForUserId,
    @TypedQueryParameter(name: 'manageForName') this.manageForName,
  });

  final String metric;
  final int verticalId;
  final int? subjectUserId;

  /// Spec 0015 R2 — carried so a drilled-in list reads the same population.
  final int? withinManagerId;

  /// Spec 0015 §4.2: set when the list is one person's caseload, which is what
  /// makes the rows actionable.
  final int? manageForUserId;
  final String? manageForName;

  /// Comma-separated ids. Strings rather than `List<int>` because go_router's
  /// generator would encode a list as repeated `?stateIds=33&stateIds=35`,
  /// while the API takes one comma-separated value.
  final String? unitTypeIds;
  final String? managerIds;
  final String? repIds;
  final String? stateIds;
  final String? municipalityIds;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  static List<int> _ids(String? raw) {
    if (raw == null || raw.isEmpty) return const [];
    return raw
        .split(',')
        .map(int.tryParse)
        .whereType<int>()
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return MetricClinicsScreen(
      metric: metric,
      manageForUserId: manageForUserId,
      manageForName: manageForName,
      scope: DashboardScopeArgs(
        verticalId: verticalId,
        subjectUserId: subjectUserId,
        withinManagerId: withinManagerId,
        unitTypeIds: _ids(unitTypeIds),
        managerIds: _ids(managerIds),
        repIds: _ids(repIds),
        stateIds: _ids(stateIds),
        municipalityIds: _ids(municipalityIds),
      ),
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

/// No `tracking` child route.
///
/// It rendered a courier, a delivery timeline and an ETA, none of which exist:
/// there is no shipping, carrier or tracking table anywhere in the schema, and
/// the screen read the order detail and invented the rest. Removed with its
/// screen and models rather than left reachable — a rep who opened it was being
/// shown a delivery that nothing in the system knows about.
@TypedGoRoute<OrderDetailRoute>(path: '/orders/:id')
class OrderDetailRoute extends GoRouteData with $OrderDetailRoute {
  const OrderDetailRoute({required this.id});

  final int id;

  static final GlobalKey<NavigatorState> $parentNavigatorKey = rootNavigatorKey;

  @override
  Widget build(BuildContext context, GoRouterState state) {
    return OrderDetailScreen(orderId: id);
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

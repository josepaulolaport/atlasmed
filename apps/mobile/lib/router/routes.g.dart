// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routes.dart';

// **************************************************************************
// GoRouterGenerator
// **************************************************************************

List<RouteBase> get $appRoutes => [
  $locationGateRoute,
  $splashRoute,
  $appShellRoute,
  $agendaNewRoute,
  $agendaEditRoute,
  $agendaOccurrenceEditRoute,
  $subjectDashboardRoute,
  $assignClinicRoute,
  $memberTerritoryRoute,
  $outOfTerritoryRoute,
  $teamMemberProfileRoute,
  $teamMemberRoute,
  $repsWithoutPatchRoute,
  $metricClinicsRoute,
  $favoritosRoute,
  $clinicDetailRoute,
  $doctorDetailRoute,
  $interactionDetailRoute,
  $orderDetailRoute,
  $registrationDetailRoute,
  $nonConformityDetailRoute,
  $productDetailRoute,
  $inviteUserRoute,
  $invitationsRoute,
  $userDetailRoute,
  $territoryEditRoute,
  $territoryCreateRoute,
  $territoryCreatePtRoute,
  $catalogHomeRoute,
  $presentationsRoute,
];

RouteBase get $locationGateRoute => GoRouteData.$route(
  path: '/location-gate',
  hasOverriddenOnExit: false,
  factory: $LocationGateRoute._fromState,
);

mixin $LocationGateRoute on GoRouteData {
  static LocationGateRoute _fromState(GoRouterState state) =>
      const LocationGateRoute();

  @override
  String get location => GoRouteData.$location('/location-gate');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $splashRoute => GoRouteData.$route(
  path: '/splash',
  hasOverriddenOnExit: false,
  factory: $SplashRoute._fromState,
  routes: [
    GoRouteData.$route(
      path: 'login',
      hasOverriddenOnExit: false,
      factory: $LoginRoute._fromState,
      routes: [
        GoRouteData.$route(
          path: 'register',
          hasOverriddenOnExit: false,
          factory: $RegisterInviteRoute._fromState,
        ),
        GoRouteData.$route(
          path: 'forgot',
          hasOverriddenOnExit: false,
          factory: $ForgotEmailRoute._fromState,
          routes: [
            GoRouteData.$route(
              path: 'code',
              hasOverriddenOnExit: false,
              factory: $ForgotCodeRoute._fromState,
            ),
            GoRouteData.$route(
              path: 'new-password',
              hasOverriddenOnExit: false,
              factory: $ForgotNewPasswordRoute._fromState,
            ),
            GoRouteData.$route(
              path: 'success',
              hasOverriddenOnExit: false,
              factory: $ForgotSuccessRoute._fromState,
            ),
          ],
        ),
      ],
    ),
  ],
);

mixin $SplashRoute on GoRouteData {
  static SplashRoute _fromState(GoRouterState state) => const SplashRoute();

  @override
  String get location => GoRouteData.$location('/splash');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $LoginRoute on GoRouteData {
  static LoginRoute _fromState(GoRouterState state) => const LoginRoute();

  @override
  String get location => GoRouteData.$location('/splash/login');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $RegisterInviteRoute on GoRouteData {
  static RegisterInviteRoute _fromState(GoRouterState state) =>
      RegisterInviteRoute(token: state.uri.queryParameters['token']);

  RegisterInviteRoute get _self => this as RegisterInviteRoute;

  @override
  String get location => GoRouteData.$location(
    '/splash/login/register',
    queryParams: {if (_self.token != null) 'token': _self.token},
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ForgotEmailRoute on GoRouteData {
  static ForgotEmailRoute _fromState(GoRouterState state) =>
      const ForgotEmailRoute();

  @override
  String get location => GoRouteData.$location('/splash/login/forgot');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ForgotCodeRoute on GoRouteData {
  static ForgotCodeRoute _fromState(GoRouterState state) =>
      const ForgotCodeRoute();

  @override
  String get location => GoRouteData.$location('/splash/login/forgot/code');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ForgotNewPasswordRoute on GoRouteData {
  static ForgotNewPasswordRoute _fromState(GoRouterState state) =>
      const ForgotNewPasswordRoute();

  @override
  String get location =>
      GoRouteData.$location('/splash/login/forgot/new-password');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ForgotSuccessRoute on GoRouteData {
  static ForgotSuccessRoute _fromState(GoRouterState state) =>
      const ForgotSuccessRoute();

  @override
  String get location => GoRouteData.$location('/splash/login/forgot/success');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $appShellRoute => StatefulShellRouteData.$route(
  factory: $AppShellRouteExtension._fromState,
  branches: [
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/dashboard',
          hasOverriddenOnExit: false,
          factory: $DashboardRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/explore',
          hasOverriddenOnExit: false,
          factory: $ExploreRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/map',
          hasOverriddenOnExit: false,
          factory: $MapRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/agenda',
          hasOverriddenOnExit: false,
          factory: $AgendaRoute._fromState,
        ),
        GoRouteData.$route(
          path: '/agenda/day/:day',
          hasOverriddenOnExit: false,
          factory: $AgendaDayRoute._fromState,
        ),
        GoRouteData.$route(
          path: '/agenda/day/:day/roteiro',
          hasOverriddenOnExit: false,
          factory: $RoteiroRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/territories',
          hasOverriddenOnExit: false,
          factory: $TerritoriesRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/users',
          hasOverriddenOnExit: false,
          factory: $UsersRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/orders',
          hasOverriddenOnExit: false,
          factory: $OrdersRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/registrations',
          hasOverriddenOnExit: false,
          factory: $RegistrationsRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/non-conformities',
          hasOverriddenOnExit: false,
          factory: $NonConformitiesRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/products',
          hasOverriddenOnExit: false,
          factory: $ProductsRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/profile',
          hasOverriddenOnExit: false,
          factory: $ProfileRoute._fromState,
        ),
      ],
    ),
    StatefulShellBranchData.$branch(
      routes: [
        GoRouteData.$route(
          path: '/team',
          hasOverriddenOnExit: false,
          factory: $TeamRoute._fromState,
        ),
      ],
    ),
  ],
);

extension $AppShellRouteExtension on AppShellRoute {
  static AppShellRoute _fromState(GoRouterState state) => const AppShellRoute();
}

mixin $DashboardRoute on GoRouteData {
  static DashboardRoute _fromState(GoRouterState state) =>
      const DashboardRoute();

  @override
  String get location => GoRouteData.$location('/dashboard');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ExploreRoute on GoRouteData {
  static ExploreRoute _fromState(GoRouterState state) => const ExploreRoute();

  @override
  String get location => GoRouteData.$location('/explore');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $MapRoute on GoRouteData {
  static MapRoute _fromState(GoRouterState state) => const MapRoute();

  @override
  String get location => GoRouteData.$location('/map');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $AgendaRoute on GoRouteData {
  static AgendaRoute _fromState(GoRouterState state) => const AgendaRoute();

  @override
  String get location => GoRouteData.$location('/agenda');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $AgendaDayRoute on GoRouteData {
  static AgendaDayRoute _fromState(GoRouterState state) => AgendaDayRoute(
    state.pathParameters['day']!,
    ownerUserId: _$convertMapValue(
      'owner-user-id',
      state.uri.queryParameters,
      int.tryParse,
    ),
    ownerName: state.uri.queryParameters['owner-name'],
  );

  AgendaDayRoute get _self => this as AgendaDayRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/day/${Uri.encodeComponent(_self.day)}',
    queryParams: {
      if (_self.ownerUserId != null)
        'owner-user-id': _self.ownerUserId!.toString(),
      if (_self.ownerName != null) 'owner-name': _self.ownerName,
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $RoteiroRoute on GoRouteData {
  static RoteiroRoute _fromState(GoRouterState state) =>
      RoteiroRoute(state.pathParameters['day']!);

  RoteiroRoute get _self => this as RoteiroRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/day/${Uri.encodeComponent(_self.day)}/roteiro',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $TerritoriesRoute on GoRouteData {
  static TerritoriesRoute _fromState(GoRouterState state) =>
      const TerritoriesRoute();

  @override
  String get location => GoRouteData.$location('/territories');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $UsersRoute on GoRouteData {
  static UsersRoute _fromState(GoRouterState state) => const UsersRoute();

  @override
  String get location => GoRouteData.$location('/users');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $OrdersRoute on GoRouteData {
  static OrdersRoute _fromState(GoRouterState state) => const OrdersRoute();

  @override
  String get location => GoRouteData.$location('/orders');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $RegistrationsRoute on GoRouteData {
  static RegistrationsRoute _fromState(GoRouterState state) =>
      const RegistrationsRoute();

  @override
  String get location => GoRouteData.$location('/registrations');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $NonConformitiesRoute on GoRouteData {
  static NonConformitiesRoute _fromState(GoRouterState state) =>
      const NonConformitiesRoute();

  @override
  String get location => GoRouteData.$location('/non-conformities');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ProductsRoute on GoRouteData {
  static ProductsRoute _fromState(GoRouterState state) => const ProductsRoute();

  @override
  String get location => GoRouteData.$location('/products');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $ProfileRoute on GoRouteData {
  static ProfileRoute _fromState(GoRouterState state) => const ProfileRoute();

  @override
  String get location => GoRouteData.$location('/profile');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $TeamRoute on GoRouteData {
  static TeamRoute _fromState(GoRouterState state) => const TeamRoute();

  @override
  String get location => GoRouteData.$location('/team');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

T? _$convertMapValue<T>(
  String key,
  Map<String, String> map,
  T? Function(String) converter,
) {
  final value = map[key];
  return value == null ? null : converter(value);
}

RouteBase get $agendaNewRoute => GoRouteData.$route(
  path: '/agenda/new',
  hasOverriddenOnExit: false,
  parentNavigatorKey: AgendaNewRoute.$parentNavigatorKey,
  factory: $AgendaNewRoute._fromState,
);

mixin $AgendaNewRoute on GoRouteData {
  static AgendaNewRoute _fromState(GoRouterState state) => AgendaNewRoute(
    facilityId: _$convertMapValue(
      'facility-id',
      state.uri.queryParameters,
      int.tryParse,
    ),
    facilityName: state.uri.queryParameters['facility-name'],
    title: state.uri.queryParameters['title'],
    personId: _$convertMapValue(
      'person-id',
      state.uri.queryParameters,
      int.tryParse,
    ),
    personName: state.uri.queryParameters['person-name'],
  );

  AgendaNewRoute get _self => this as AgendaNewRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/new',
    queryParams: {
      if (_self.facilityId != null) 'facility-id': _self.facilityId!.toString(),
      if (_self.facilityName != null) 'facility-name': _self.facilityName,
      if (_self.title != null) 'title': _self.title,
      if (_self.personId != null) 'person-id': _self.personId!.toString(),
      if (_self.personName != null) 'person-name': _self.personName,
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $agendaEditRoute => GoRouteData.$route(
  path: '/agenda/:id/edit',
  hasOverriddenOnExit: false,
  parentNavigatorKey: AgendaEditRoute.$parentNavigatorKey,
  factory: $AgendaEditRoute._fromState,
);

mixin $AgendaEditRoute on GoRouteData {
  static AgendaEditRoute _fromState(GoRouterState state) => AgendaEditRoute(
    id: int.parse(state.pathParameters['id']!),
    recurrenceKey: state.uri.queryParameters['recurrence-key'],
    $extra: state.extra as CalendarOccurrence?,
  );

  AgendaEditRoute get _self => this as AgendaEditRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/${Uri.encodeComponent(_self.id.toString())}/edit',
    queryParams: {
      if (_self.recurrenceKey != null) 'recurrence-key': _self.recurrenceKey,
    },
  );

  @override
  void go(BuildContext context) => context.go(location, extra: _self.$extra);

  @override
  Future<T?> push<T>(BuildContext context) =>
      context.push<T>(location, extra: _self.$extra);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location, extra: _self.$extra);

  @override
  void replace(BuildContext context) =>
      context.replace(location, extra: _self.$extra);
}

RouteBase get $agendaOccurrenceEditRoute => GoRouteData.$route(
  path: '/agenda/:id/occurrences/:recurrenceKey/edit',
  hasOverriddenOnExit: false,
  parentNavigatorKey: AgendaOccurrenceEditRoute.$parentNavigatorKey,
  factory: $AgendaOccurrenceEditRoute._fromState,
);

mixin $AgendaOccurrenceEditRoute on GoRouteData {
  static AgendaOccurrenceEditRoute _fromState(GoRouterState state) =>
      AgendaOccurrenceEditRoute(
        id: int.parse(state.pathParameters['id']!),
        recurrenceKey: state.pathParameters['recurrenceKey']!,
        $extra: state.extra as CalendarOccurrence?,
      );

  AgendaOccurrenceEditRoute get _self => this as AgendaOccurrenceEditRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/${Uri.encodeComponent(_self.id.toString())}/occurrences/${Uri.encodeComponent(_self.recurrenceKey)}/edit',
  );

  @override
  void go(BuildContext context) => context.go(location, extra: _self.$extra);

  @override
  Future<T?> push<T>(BuildContext context) =>
      context.push<T>(location, extra: _self.$extra);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location, extra: _self.$extra);

  @override
  void replace(BuildContext context) =>
      context.replace(location, extra: _self.$extra);
}

RouteBase get $subjectDashboardRoute => GoRouteData.$route(
  path: '/team/member/:subjectUserId',
  hasOverriddenOnExit: false,
  parentNavigatorKey: SubjectDashboardRoute.$parentNavigatorKey,
  factory: $SubjectDashboardRoute._fromState,
);

mixin $SubjectDashboardRoute on GoRouteData {
  static SubjectDashboardRoute _fromState(GoRouterState state) =>
      SubjectDashboardRoute(
        subjectUserId: int.parse(state.pathParameters['subjectUserId']!),
        subjectName: state.uri.queryParameters['subjectName'],
        subjectRole: state.uri.queryParameters['subjectRole'],
        withinManagerId: _$convertMapValue(
          'withinManagerId',
          state.uri.queryParameters,
          int.tryParse,
        ),
      );

  SubjectDashboardRoute get _self => this as SubjectDashboardRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/member/${Uri.encodeComponent(_self.subjectUserId.toString())}',
    queryParams: {
      if (_self.subjectName != null) 'subjectName': _self.subjectName,
      if (_self.subjectRole != null) 'subjectRole': _self.subjectRole,
      if (_self.withinManagerId != null)
        'withinManagerId': _self.withinManagerId!.toString(),
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $assignClinicRoute => GoRouteData.$route(
  path: '/team/profile/:userId/assign-clinic',
  hasOverriddenOnExit: false,
  parentNavigatorKey: AssignClinicRoute.$parentNavigatorKey,
  factory: $AssignClinicRoute._fromState,
);

mixin $AssignClinicRoute on GoRouteData {
  static AssignClinicRoute _fromState(GoRouterState state) => AssignClinicRoute(
    userId: int.parse(state.pathParameters['userId']!),
    memberName: state.uri.queryParameters['memberName'],
  );

  AssignClinicRoute get _self => this as AssignClinicRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/profile/${Uri.encodeComponent(_self.userId.toString())}/assign-clinic',
    queryParams: {if (_self.memberName != null) 'memberName': _self.memberName},
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $memberTerritoryRoute => GoRouteData.$route(
  path: '/team/profile/:userId/territory',
  hasOverriddenOnExit: false,
  parentNavigatorKey: MemberTerritoryRoute.$parentNavigatorKey,
  factory: $MemberTerritoryRoute._fromState,
);

mixin $MemberTerritoryRoute on GoRouteData {
  static MemberTerritoryRoute _fromState(GoRouterState state) =>
      MemberTerritoryRoute(
        userId: int.parse(state.pathParameters['userId']!),
        memberName: state.uri.queryParameters['memberName'],
        viaManagerId: _$convertMapValue(
          'viaManagerId',
          state.uri.queryParameters,
          int.tryParse,
        ),
        isRep: _$convertMapValue(
          'isRep',
          state.uri.queryParameters,
          _$boolConverter,
        ),
      );

  MemberTerritoryRoute get _self => this as MemberTerritoryRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/profile/${Uri.encodeComponent(_self.userId.toString())}/territory',
    queryParams: {
      if (_self.memberName != null) 'memberName': _self.memberName,
      if (_self.viaManagerId != null)
        'viaManagerId': _self.viaManagerId!.toString(),
      if (_self.isRep != null) 'isRep': _self.isRep!.toString(),
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

bool _$boolConverter(String value) {
  switch (value) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      throw UnsupportedError('Cannot convert "$value" into a bool.');
  }
}

RouteBase get $outOfTerritoryRoute => GoRouteData.$route(
  path: '/team/profile/:userId/out-of-territory',
  hasOverriddenOnExit: false,
  parentNavigatorKey: OutOfTerritoryRoute.$parentNavigatorKey,
  factory: $OutOfTerritoryRoute._fromState,
);

mixin $OutOfTerritoryRoute on GoRouteData {
  static OutOfTerritoryRoute _fromState(GoRouterState state) =>
      OutOfTerritoryRoute(
        userId: int.parse(state.pathParameters['userId']!),
        memberName: state.uri.queryParameters['memberName'],
      );

  OutOfTerritoryRoute get _self => this as OutOfTerritoryRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/profile/${Uri.encodeComponent(_self.userId.toString())}/out-of-territory',
    queryParams: {if (_self.memberName != null) 'memberName': _self.memberName},
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $teamMemberProfileRoute => GoRouteData.$route(
  path: '/team/profile/:userId',
  hasOverriddenOnExit: false,
  parentNavigatorKey: TeamMemberProfileRoute.$parentNavigatorKey,
  factory: $TeamMemberProfileRoute._fromState,
);

mixin $TeamMemberProfileRoute on GoRouteData {
  static TeamMemberProfileRoute _fromState(GoRouterState state) =>
      TeamMemberProfileRoute(
        userId: int.parse(state.pathParameters['userId']!),
        memberName: state.uri.queryParameters['memberName'],
        viaManagerId: _$convertMapValue(
          'viaManagerId',
          state.uri.queryParameters,
          int.tryParse,
        ),
      );

  TeamMemberProfileRoute get _self => this as TeamMemberProfileRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/profile/${Uri.encodeComponent(_self.userId.toString())}',
    queryParams: {
      if (_self.memberName != null) 'memberName': _self.memberName,
      if (_self.viaManagerId != null)
        'viaManagerId': _self.viaManagerId!.toString(),
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $teamMemberRoute => GoRouteData.$route(
  path: '/team/manager/:managerId',
  hasOverriddenOnExit: false,
  parentNavigatorKey: TeamMemberRoute.$parentNavigatorKey,
  factory: $TeamMemberRoute._fromState,
);

mixin $TeamMemberRoute on GoRouteData {
  static TeamMemberRoute _fromState(GoRouterState state) => TeamMemberRoute(
    managerId: int.parse(state.pathParameters['managerId']!),
    managerName: state.uri.queryParameters['managerName'],
  );

  TeamMemberRoute get _self => this as TeamMemberRoute;

  @override
  String get location => GoRouteData.$location(
    '/team/manager/${Uri.encodeComponent(_self.managerId.toString())}',
    queryParams: {
      if (_self.managerName != null) 'managerName': _self.managerName,
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $repsWithoutPatchRoute => GoRouteData.$route(
  path: '/team/reps-without-patch',
  hasOverriddenOnExit: false,
  parentNavigatorKey: RepsWithoutPatchRoute.$parentNavigatorKey,
  factory: $RepsWithoutPatchRoute._fromState,
);

mixin $RepsWithoutPatchRoute on GoRouteData {
  static RepsWithoutPatchRoute _fromState(GoRouterState state) =>
      const RepsWithoutPatchRoute();

  @override
  String get location => GoRouteData.$location('/team/reps-without-patch');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $metricClinicsRoute => GoRouteData.$route(
  path: '/dashboard/metrics/:metric/clinics',
  hasOverriddenOnExit: false,
  parentNavigatorKey: MetricClinicsRoute.$parentNavigatorKey,
  factory: $MetricClinicsRoute._fromState,
);

mixin $MetricClinicsRoute on GoRouteData {
  static MetricClinicsRoute _fromState(GoRouterState state) =>
      MetricClinicsRoute(
        metric: state.pathParameters['metric']!,
        verticalId: int.parse(state.uri.queryParameters['verticalId']!),
        subjectUserId: _$convertMapValue(
          'subjectUserId',
          state.uri.queryParameters,
          int.tryParse,
        ),
        unitTypeIds: state.uri.queryParameters['unitTypeIds'],
        managerIds: state.uri.queryParameters['managerIds'],
        repIds: state.uri.queryParameters['repIds'],
        stateIds: state.uri.queryParameters['stateIds'],
        municipalityIds: state.uri.queryParameters['municipalityIds'],
        withinManagerId: _$convertMapValue(
          'withinManagerId',
          state.uri.queryParameters,
          int.tryParse,
        ),
        manageForUserId: _$convertMapValue(
          'manageForUserId',
          state.uri.queryParameters,
          int.tryParse,
        ),
        manageForName: state.uri.queryParameters['manageForName'],
      );

  MetricClinicsRoute get _self => this as MetricClinicsRoute;

  @override
  String get location => GoRouteData.$location(
    '/dashboard/metrics/${Uri.encodeComponent(_self.metric)}/clinics',
    queryParams: {
      'verticalId': _self.verticalId.toString(),
      if (_self.subjectUserId != null)
        'subjectUserId': _self.subjectUserId!.toString(),
      if (_self.unitTypeIds != null) 'unitTypeIds': _self.unitTypeIds,
      if (_self.managerIds != null) 'managerIds': _self.managerIds,
      if (_self.repIds != null) 'repIds': _self.repIds,
      if (_self.stateIds != null) 'stateIds': _self.stateIds,
      if (_self.municipalityIds != null)
        'municipalityIds': _self.municipalityIds,
      if (_self.withinManagerId != null)
        'withinManagerId': _self.withinManagerId!.toString(),
      if (_self.manageForUserId != null)
        'manageForUserId': _self.manageForUserId!.toString(),
      if (_self.manageForName != null) 'manageForName': _self.manageForName,
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $favoritosRoute => GoRouteData.$route(
  path: '/explore/favoritos',
  hasOverriddenOnExit: false,
  parentNavigatorKey: FavoritosRoute.$parentNavigatorKey,
  factory: $FavoritosRoute._fromState,
);

mixin $FavoritosRoute on GoRouteData {
  static FavoritosRoute _fromState(GoRouterState state) =>
      const FavoritosRoute();

  @override
  String get location => GoRouteData.$location('/explore/favoritos');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $clinicDetailRoute => GoRouteData.$route(
  path: '/explore/clinic/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: ClinicDetailRoute.$parentNavigatorKey,
  factory: $ClinicDetailRoute._fromState,
);

mixin $ClinicDetailRoute on GoRouteData {
  static ClinicDetailRoute _fromState(GoRouterState state) => ClinicDetailRoute(
    id: int.parse(state.pathParameters['id']!),
    verticalId: _$convertMapValue(
      'verticalId',
      state.uri.queryParameters,
      int.tryParse,
    ),
  );

  ClinicDetailRoute get _self => this as ClinicDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/explore/clinic/${Uri.encodeComponent(_self.id.toString())}',
    queryParams: {
      if (_self.verticalId != null) 'verticalId': _self.verticalId!.toString(),
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $doctorDetailRoute => GoRouteData.$route(
  path: '/explore/doctor/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: DoctorDetailRoute.$parentNavigatorKey,
  factory: $DoctorDetailRoute._fromState,
);

mixin $DoctorDetailRoute on GoRouteData {
  static DoctorDetailRoute _fromState(GoRouterState state) => DoctorDetailRoute(
    id: int.parse(state.pathParameters['id']!),
    facilityId: _$convertMapValue(
      'facilityId',
      state.uri.queryParameters,
      int.tryParse,
    ),
  );

  DoctorDetailRoute get _self => this as DoctorDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/explore/doctor/${Uri.encodeComponent(_self.id.toString())}',
    queryParams: {
      if (_self.facilityId != null) 'facilityId': _self.facilityId!.toString(),
    },
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $interactionDetailRoute => GoRouteData.$route(
  path: '/agenda/interactions/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: InteractionDetailRoute.$parentNavigatorKey,
  factory: $InteractionDetailRoute._fromState,
);

mixin $InteractionDetailRoute on GoRouteData {
  static InteractionDetailRoute _fromState(GoRouterState state) =>
      InteractionDetailRoute(id: int.parse(state.pathParameters['id']!));

  InteractionDetailRoute get _self => this as InteractionDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/agenda/interactions/${Uri.encodeComponent(_self.id.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $orderDetailRoute => GoRouteData.$route(
  path: '/orders/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: OrderDetailRoute.$parentNavigatorKey,
  factory: $OrderDetailRoute._fromState,
);

mixin $OrderDetailRoute on GoRouteData {
  static OrderDetailRoute _fromState(GoRouterState state) =>
      OrderDetailRoute(id: int.parse(state.pathParameters['id']!));

  OrderDetailRoute get _self => this as OrderDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/orders/${Uri.encodeComponent(_self.id.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $registrationDetailRoute => GoRouteData.$route(
  path: '/registrations/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: RegistrationDetailRoute.$parentNavigatorKey,
  factory: $RegistrationDetailRoute._fromState,
);

mixin $RegistrationDetailRoute on GoRouteData {
  static RegistrationDetailRoute _fromState(GoRouterState state) =>
      RegistrationDetailRoute(id: int.parse(state.pathParameters['id']!));

  RegistrationDetailRoute get _self => this as RegistrationDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/registrations/${Uri.encodeComponent(_self.id.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $nonConformityDetailRoute => GoRouteData.$route(
  path: '/non-conformities/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: NonConformityDetailRoute.$parentNavigatorKey,
  factory: $NonConformityDetailRoute._fromState,
);

mixin $NonConformityDetailRoute on GoRouteData {
  static NonConformityDetailRoute _fromState(GoRouterState state) =>
      NonConformityDetailRoute(id: int.parse(state.pathParameters['id']!));

  NonConformityDetailRoute get _self => this as NonConformityDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/non-conformities/${Uri.encodeComponent(_self.id.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $productDetailRoute => GoRouteData.$route(
  path: '/products/:familyId',
  hasOverriddenOnExit: false,
  parentNavigatorKey: ProductDetailRoute.$parentNavigatorKey,
  factory: $ProductDetailRoute._fromState,
);

mixin $ProductDetailRoute on GoRouteData {
  static ProductDetailRoute _fromState(GoRouterState state) =>
      ProductDetailRoute(
        familyId: int.parse(state.pathParameters['familyId']!),
      );

  ProductDetailRoute get _self => this as ProductDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/products/${Uri.encodeComponent(_self.familyId.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $inviteUserRoute => GoRouteData.$route(
  path: '/users/invite',
  hasOverriddenOnExit: false,
  parentNavigatorKey: InviteUserRoute.$parentNavigatorKey,
  factory: $InviteUserRoute._fromState,
);

mixin $InviteUserRoute on GoRouteData {
  static InviteUserRoute _fromState(GoRouterState state) =>
      const InviteUserRoute();

  @override
  String get location => GoRouteData.$location('/users/invite');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $invitationsRoute => GoRouteData.$route(
  path: '/users/invitations',
  hasOverriddenOnExit: false,
  parentNavigatorKey: InvitationsRoute.$parentNavigatorKey,
  factory: $InvitationsRoute._fromState,
  routes: [
    GoRouteData.$route(
      path: ':invitationId',
      hasOverriddenOnExit: false,
      parentNavigatorKey: InvitationDetailRoute.$parentNavigatorKey,
      factory: $InvitationDetailRoute._fromState,
      routes: [
        GoRouteData.$route(
          path: 'edit',
          hasOverriddenOnExit: false,
          parentNavigatorKey: InvitationEditRoute.$parentNavigatorKey,
          factory: $InvitationEditRoute._fromState,
        ),
      ],
    ),
  ],
);

mixin $InvitationsRoute on GoRouteData {
  static InvitationsRoute _fromState(GoRouterState state) =>
      const InvitationsRoute();

  @override
  String get location => GoRouteData.$location('/users/invitations');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $InvitationDetailRoute on GoRouteData {
  static InvitationDetailRoute _fromState(GoRouterState state) =>
      InvitationDetailRoute(
        invitationId: int.parse(state.pathParameters['invitationId']!),
      );

  InvitationDetailRoute get _self => this as InvitationDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/users/invitations/${Uri.encodeComponent(_self.invitationId.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $InvitationEditRoute on GoRouteData {
  static InvitationEditRoute _fromState(GoRouterState state) =>
      InvitationEditRoute(
        invitationId: int.parse(state.pathParameters['invitationId']!),
      );

  InvitationEditRoute get _self => this as InvitationEditRoute;

  @override
  String get location => GoRouteData.$location(
    '/users/invitations/${Uri.encodeComponent(_self.invitationId.toString())}/edit',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $userDetailRoute => GoRouteData.$route(
  path: '/users/:id',
  hasOverriddenOnExit: false,
  parentNavigatorKey: UserDetailRoute.$parentNavigatorKey,
  factory: $UserDetailRoute._fromState,
  routes: [
    GoRouteData.$route(
      path: 'edit',
      hasOverriddenOnExit: false,
      parentNavigatorKey: UserEditRoute.$parentNavigatorKey,
      factory: $UserEditRoute._fromState,
    ),
    GoRouteData.$route(
      path: 'assignments',
      hasOverriddenOnExit: false,
      parentNavigatorKey: UserAssignmentsRoute.$parentNavigatorKey,
      factory: $UserAssignmentsRoute._fromState,
    ),
  ],
);

mixin $UserDetailRoute on GoRouteData {
  static UserDetailRoute _fromState(GoRouterState state) =>
      UserDetailRoute(id: int.parse(state.pathParameters['id']!));

  UserDetailRoute get _self => this as UserDetailRoute;

  @override
  String get location => GoRouteData.$location(
    '/users/${Uri.encodeComponent(_self.id.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $UserEditRoute on GoRouteData {
  static UserEditRoute _fromState(GoRouterState state) =>
      UserEditRoute(id: int.parse(state.pathParameters['id']!));

  UserEditRoute get _self => this as UserEditRoute;

  @override
  String get location => GoRouteData.$location(
    '/users/${Uri.encodeComponent(_self.id.toString())}/edit',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $UserAssignmentsRoute on GoRouteData {
  static UserAssignmentsRoute _fromState(GoRouterState state) =>
      UserAssignmentsRoute(id: int.parse(state.pathParameters['id']!));

  UserAssignmentsRoute get _self => this as UserAssignmentsRoute;

  @override
  String get location => GoRouteData.$location(
    '/users/${Uri.encodeComponent(_self.id.toString())}/assignments',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $territoryEditRoute => GoRouteData.$route(
  path: '/territories/:id/edit',
  hasOverriddenOnExit: false,
  parentNavigatorKey: TerritoryEditRoute.$parentNavigatorKey,
  factory: $TerritoryEditRoute._fromState,
);

mixin $TerritoryEditRoute on GoRouteData {
  static TerritoryEditRoute _fromState(GoRouterState state) =>
      TerritoryEditRoute(id: int.parse(state.pathParameters['id']!));

  TerritoryEditRoute get _self => this as TerritoryEditRoute;

  @override
  String get location => GoRouteData.$location(
    '/territories/${Uri.encodeComponent(_self.id.toString())}/edit',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $territoryCreateRoute => GoRouteData.$route(
  path: '/territories/create',
  hasOverriddenOnExit: false,
  parentNavigatorKey: TerritoryCreateRoute.$parentNavigatorKey,
  factory: $TerritoryCreateRoute._fromState,
);

mixin $TerritoryCreateRoute on GoRouteData {
  static TerritoryCreateRoute _fromState(GoRouterState state) =>
      TerritoryCreateRoute($extra: state.extra as TerritoryEditorTarget?);

  TerritoryCreateRoute get _self => this as TerritoryCreateRoute;

  @override
  String get location => GoRouteData.$location('/territories/create');

  @override
  void go(BuildContext context) => context.go(location, extra: _self.$extra);

  @override
  Future<T?> push<T>(BuildContext context) =>
      context.push<T>(location, extra: _self.$extra);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location, extra: _self.$extra);

  @override
  void replace(BuildContext context) =>
      context.replace(location, extra: _self.$extra);
}

RouteBase get $territoryCreatePtRoute => GoRouteData.$route(
  path: '/territories/criar',
  hasOverriddenOnExit: false,
  parentNavigatorKey: TerritoryCreatePtRoute.$parentNavigatorKey,
  factory: $TerritoryCreatePtRoute._fromState,
);

mixin $TerritoryCreatePtRoute on GoRouteData {
  static TerritoryCreatePtRoute _fromState(GoRouterState state) =>
      TerritoryCreatePtRoute($extra: state.extra as TerritoryEditorTarget?);

  TerritoryCreatePtRoute get _self => this as TerritoryCreatePtRoute;

  @override
  String get location => GoRouteData.$location('/territories/criar');

  @override
  void go(BuildContext context) => context.go(location, extra: _self.$extra);

  @override
  Future<T?> push<T>(BuildContext context) =>
      context.push<T>(location, extra: _self.$extra);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location, extra: _self.$extra);

  @override
  void replace(BuildContext context) =>
      context.replace(location, extra: _self.$extra);
}

RouteBase get $catalogHomeRoute => GoRouteData.$route(
  path: '/catalog',
  hasOverriddenOnExit: false,
  parentNavigatorKey: CatalogHomeRoute.$parentNavigatorKey,
  factory: $CatalogHomeRoute._fromState,
  routes: [
    GoRouteData.$route(
      path: 'potential-definitions',
      hasOverriddenOnExit: false,
      parentNavigatorKey: CatalogPotentialDefinitionsRoute.$parentNavigatorKey,
      factory: $CatalogPotentialDefinitionsRoute._fromState,
    ),
    GoRouteData.$route(
      path: 'price-index',
      hasOverriddenOnExit: false,
      parentNavigatorKey: CatalogPriceIndexRoute.$parentNavigatorKey,
      factory: $CatalogPriceIndexRoute._fromState,
    ),
    GoRouteData.$route(
      path: 'comparison/:variantId',
      hasOverriddenOnExit: false,
      parentNavigatorKey: CatalogComparisonRoute.$parentNavigatorKey,
      factory: $CatalogComparisonRoute._fromState,
    ),
  ],
);

mixin $CatalogHomeRoute on GoRouteData {
  static CatalogHomeRoute _fromState(GoRouterState state) =>
      const CatalogHomeRoute();

  @override
  String get location => GoRouteData.$location('/catalog');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $CatalogPotentialDefinitionsRoute on GoRouteData {
  static CatalogPotentialDefinitionsRoute _fromState(GoRouterState state) =>
      const CatalogPotentialDefinitionsRoute();

  @override
  String get location =>
      GoRouteData.$location('/catalog/potential-definitions');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $CatalogPriceIndexRoute on GoRouteData {
  static CatalogPriceIndexRoute _fromState(GoRouterState state) =>
      const CatalogPriceIndexRoute();

  @override
  String get location => GoRouteData.$location('/catalog/price-index');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

mixin $CatalogComparisonRoute on GoRouteData {
  static CatalogComparisonRoute _fromState(GoRouterState state) =>
      CatalogComparisonRoute(
        variantId: int.parse(state.pathParameters['variantId']!),
      );

  CatalogComparisonRoute get _self => this as CatalogComparisonRoute;

  @override
  String get location => GoRouteData.$location(
    '/catalog/comparison/${Uri.encodeComponent(_self.variantId.toString())}',
  );

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

RouteBase get $presentationsRoute => GoRouteData.$route(
  path: '/presentations',
  hasOverriddenOnExit: false,
  parentNavigatorKey: PresentationsRoute.$parentNavigatorKey,
  factory: $PresentationsRoute._fromState,
);

mixin $PresentationsRoute on GoRouteData {
  static PresentationsRoute _fromState(GoRouterState state) =>
      const PresentationsRoute();

  @override
  String get location => GoRouteData.$location('/presentations');

  @override
  void go(BuildContext context) => context.go(location);

  @override
  Future<T?> push<T>(BuildContext context) => context.push<T>(location);

  @override
  void pushReplacement(BuildContext context) =>
      context.pushReplacement(location);

  @override
  void replace(BuildContext context) => context.replace(location);
}

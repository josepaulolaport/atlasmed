import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// One metric, one request (spec 0014 §4).
///
/// Each instance owns a single endpoint and resolves on its own, which is what
/// gives the screen its per-card skeletons: a slow penetração query cannot hold
/// up cobertura, and a failing one leaves the rest of the screen intact. The
/// previous `/dashboard/summary` made both impossible by construction.
class DashboardMetricRepository<T> extends Repository<T>
    with SessionEnvironmentMixin<T> {
  DashboardMetricRepository({
    required String path,
    required DashboardScopeArgs args,
    required T Function(Map<String, dynamic> json) parse,
    Map<String, String> extraQuery = const {},
  }) : _parse = parse,
       super(
         name: 'Dashboard${path.replaceAll('/', '_')}',
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1$path',
         ).replace(queryParameters: {...args.toQuery(), ...extraQuery}),
       );

  final T Function(Map<String, dynamic> json) _parse;

  @override
  T fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) {
      throw FormatException('Unexpected dashboard payload: $json');
    }
    return _parse(decoded);
  }
}

DashboardMetricRepository<DashboardCountMetric> assignedClinicsRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/assigned-clinics',
  args: args,
  parse: DashboardCountMetric.fromJson,
);

DashboardMetricRepository<DashboardRatioMetric> coverageRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/coverage',
  args: args,
  parse: DashboardRatioMetric.coverageFromJson,
);

DashboardMetricRepository<DashboardBuckets> purchaseBucketsRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/purchase-buckets',
  args: args,
  parse: (json) => DashboardBuckets.fromJson(
    json['buckets'] as Map<String, dynamic>? ?? const {},
  ),
);

DashboardMetricRepository<DashboardRatioMetric> cadastroCompletionRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/cadastro-completion',
  args: args,
  parse: DashboardRatioMetric.cadastroFromJson,
);

DashboardMetricRepository<DashboardOrdersMetric> ordersRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/orders',
  args: args,
  parse: DashboardOrdersMetric.fromJson,
);

DashboardMetricRepository<DashboardPenetrationMetric> penetrationRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/penetration',
  args: args,
  parse: DashboardPenetrationMetric.fromJson,
);

DashboardMetricRepository<DashboardCountMetric> unassignedClinicsRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/metrics/unassigned-clinics',
  args: args,
  parse: DashboardCountMetric.fromJson,
);

DashboardMetricRepository<DashboardTerritory> territoryRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/territory',
  args: args,
  parse: DashboardTerritory.fromJson,
);

DashboardMetricRepository<DashboardClinicPage> metricClinicsRepository({
  required String metric,
  required DashboardScopeArgs args,
  int page = 1,
  int limit = 25,
}) => DashboardMetricRepository(
  path: '/dashboard/metrics/$metric/clinics',
  args: args,
  parse: DashboardClinicPage.fromJson,
  extraQuery: {'page': '$page', 'limit': '$limit'},
);

/// The Equipe roster. `sortBy` is what turns it into a leaderboard — the API
/// computes only that metric per member (spec 0014 §6).
DashboardMetricRepository<List<TeamMember>> teamRepository({
  required int verticalId,
  int? managerId,
  String sortBy = 'name',
  String order = 'asc',
}) => DashboardMetricRepository(
  path: '/team',
  args: DashboardScopeArgs(verticalId: verticalId),
  parse: (json) => (json['data'] as List<dynamic>? ?? const [])
      .whereType<Map<String, dynamic>>()
      .map(TeamMember.fromJson)
      .toList(growable: false),
  extraQuery: {
    if (managerId != null) 'managerId': '$managerId',
    'sortBy': sortBy,
    'order': order,
  },
);

class RepsWithoutPatchRepository extends Repository<List<TeamMember>>
    with SessionEnvironmentMixin<List<TeamMember>> {
  RepsWithoutPatchRepository()
    : super(
        name: 'RepsWithoutPatchRepository',
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/team/reps-without-patch',
        ),
      );

  @override
  List<TeamMember> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    return (decoded['data'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(TeamMember.fromJson)
        .toList(growable: false);
  }
}

/// What each filter drawer can currently offer (spec 0014 §5).
///
/// Takes the whole scope, because the options are progressive: the request
/// carries the filters already chosen, and the API answers each facet with
/// every filter applied *except its own*. Re-fetched on every selection change,
/// which is what keeps the drawers narrowing as the user goes.
DashboardMetricRepository<DashboardFilterOptions> filterOptionsRepository(
  DashboardScopeArgs args,
) => DashboardMetricRepository(
  path: '/dashboard/filter-options',
  args: args,
  parse: DashboardFilterOptions.fromJson,
);

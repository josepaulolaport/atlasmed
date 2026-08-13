import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

double? _readRatio(dynamic raw) {
  if (raw == null) return null;
  if (raw is num) return raw.toDouble();
  return double.tryParse('$raw');
}

int _readInt(dynamic raw) {
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  return int.tryParse('$raw') ?? 0;
}

/// A count with no denominator — Clínicas atribuídas, Clínicas não atribuídas.
class DashboardCountMetric {
  const DashboardCountMetric({required this.value});

  final int value;

  factory DashboardCountMetric.fromJson(Map<String, dynamic> json) =>
      DashboardCountMetric(value: _readInt(json['value']));
}

/// Buckets of `purchase_funnel_stage` — the donut, and Cobertura's numerator.
class DashboardBuckets {
  const DashboardBuckets({
    required this.active,
    required this.inactive,
    required this.neverBought,
    required this.total,
  });

  final int active;
  final int inactive;
  final int neverBought;
  final int total;

  factory DashboardBuckets.fromJson(Map<String, dynamic> json) {
    return DashboardBuckets(
      active: _readInt(json['active']),
      inactive: _readInt(json['inactive']),
      neverBought: _readInt(json['neverBought']),
      total: _readInt(json['total']),
    );
  }
}

/// A ratio the API declines to compute when the denominator is empty.
///
/// [percent] is null — never 0 — for an empty scope: a rep with no clinics has
/// no coverage figure, and 0% would read as a failure rather than an absence.
class DashboardRatioMetric {
  const DashboardRatioMetric({
    required this.numerator,
    required this.denominator,
    required this.percent,
    this.buckets,
  });

  final int numerator;
  final int denominator;
  final double? percent;
  final DashboardBuckets? buckets;

  factory DashboardRatioMetric.coverageFromJson(Map<String, dynamic> json) {
    return DashboardRatioMetric(
      numerator: _readInt(json['covered']),
      denominator: _readInt(json['denominator']),
      percent: _readRatio(json['percent']),
      buckets: json['buckets'] is Map<String, dynamic>
          ? DashboardBuckets.fromJson(json['buckets'] as Map<String, dynamic>)
          : null,
    );
  }

  factory DashboardRatioMetric.cadastroFromJson(Map<String, dynamic> json) {
    return DashboardRatioMetric(
      numerator: _readInt(json['registered']),
      denominator: _readInt(json['denominator']),
      percent: _readRatio(json['percent']),
    );
  }
}

class DashboardOrdersMetric {
  const DashboardOrdersMetric({required this.week, required this.month});

  final int week;
  final int month;

  factory DashboardOrdersMetric.fromJson(Map<String, dynamic> json) {
    return DashboardOrdersMetric(
      week: _readInt(json['week']),
      month: _readInt(json['month']),
    );
  }
}

/// Penetração média for one metric of the linha.
///
/// [clinicsCounted] is shown beside the mean on purpose: an average over 3 of
/// 200 clinics is a real number about very little, and the card has to say so.
class DashboardPenetrationEntry {
  const DashboardPenetrationEntry({
    required this.definitionId,
    required this.key,
    required this.label,
    required this.meanShare,
    required this.clinicsCounted,
  });

  final int definitionId;
  final String key;
  final String label;
  final double? meanShare;
  final int clinicsCounted;

  factory DashboardPenetrationEntry.fromJson(Map<String, dynamic> json) {
    return DashboardPenetrationEntry(
      definitionId: readCrmId(json['definitionId'], 'definitionId'),
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      meanShare: _readRatio(json['meanShare']),
      clinicsCounted: _readInt(json['clinicsCounted']),
    );
  }
}

class DashboardPenetrationMetric {
  const DashboardPenetrationMetric({
    required this.denominator,
    required this.metrics,
  });

  final int denominator;
  final List<DashboardPenetrationEntry> metrics;

  factory DashboardPenetrationMetric.fromJson(Map<String, dynamic> json) {
    return DashboardPenetrationMetric(
      denominator: _readInt(json['denominator']),
      metrics: (json['metrics'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DashboardPenetrationEntry.fromJson)
          .toList(growable: false),
    );
  }
}

/// One row of a metric's per-clinic breakdown (spec 0014 §4.1).
class DashboardClinicRow {
  const DashboardClinicRow({
    required this.facilityId,
    required this.name,
    required this.purchaseFunnelStage,
    required this.conformityStatus,
    this.city,
    this.state,
    this.repName,
  });

  final int facilityId;
  final String name;
  final String purchaseFunnelStage;
  final String conformityStatus;
  final String? city;
  final String? state;
  final String? repName;

  String get locationLabel {
    final parts = [city, state].where((p) => p != null && p.isNotEmpty);
    return parts.join(' · ');
  }

  factory DashboardClinicRow.fromJson(Map<String, dynamic> json) {
    return DashboardClinicRow(
      facilityId: readCrmId(json['facilityId'], 'facilityId'),
      name: json['name'] as String? ?? '',
      purchaseFunnelStage: json['purchaseFunnelStage'] as String? ?? '',
      conformityStatus: json['conformityStatus'] as String? ?? '',
      city: json['city'] as String?,
      state: json['state'] as String?,
      repName: json['repName'] as String?,
    );
  }
}

class DashboardClinicPage {
  const DashboardClinicPage({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  final List<DashboardClinicRow> data;
  final int total;
  final int page;
  final int limit;

  bool get hasMore => page * limit < total;

  factory DashboardClinicPage.fromJson(Map<String, dynamic> json) {
    return DashboardClinicPage(
      data: (json['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DashboardClinicRow.fromJson)
          .toList(growable: false),
      total: _readInt(json['total']),
      page: _readInt(json['page']),
      limit: _readInt(json['limit']),
    );
  }
}

/// Visualisation mode for the territory card.
enum TerritoryMode {
  global,
  assigned,
  empty;

  bool get showMap =>
      this == TerritoryMode.global || this == TerritoryMode.assigned;

  static TerritoryMode fromJson(String value) => switch (value) {
    'global' => TerritoryMode.global,
    'assigned' => TerritoryMode.assigned,
    'empty' || _ => TerritoryMode.empty,
  };
}

class DashboardTerritoryFeature {
  const DashboardTerritoryFeature({
    required this.id,
    required this.name,
    this.boundary,
  });

  final int id;
  final String name;
  final Map<String, dynamic>? boundary;

  factory DashboardTerritoryFeature.fromJson(Map<String, dynamic> json) {
    final raw = json['boundary'];
    return DashboardTerritoryFeature(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      boundary: raw is Map<String, dynamic> ? raw : null,
    );
  }
}

class DashboardTerritory {
  const DashboardTerritory({
    required this.mode,
    required this.clinicCount,
    required this.doctorCount,
    required this.features,
    this.label,
  });

  final TerritoryMode mode;
  final String? label;
  final int clinicCount;
  final int doctorCount;
  final List<DashboardTerritoryFeature> features;

  factory DashboardTerritory.fromJson(Map<String, dynamic> json) {
    return DashboardTerritory(
      mode: TerritoryMode.fromJson(json['mode'] as String? ?? 'empty'),
      label: json['label'] as String?,
      clinicCount: _readInt(json['clinicCount']),
      doctorCount: _readInt(json['doctorCount']),
      features: (json['features'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DashboardTerritoryFeature.fromJson)
          .toList(growable: false),
    );
  }
}

/// Every metric a roster row shows, for one person (spec 0014 §6).
///
/// All four arrive with the roster whatever the sort is, so a row can be read
/// on its own terms instead of only through the column it happens to be ordered
/// by. Percentages are null when the person has no clinics — a missing figure,
/// not a zero.
class TeamMemberMetrics {
  const TeamMemberMetrics({
    required this.assignedClinics,
    required this.ordersMonth,
    this.coveragePercent,
    this.cadastroPercent,
  });

  final int assignedClinics;
  final double? coveragePercent;
  final double? cadastroPercent;
  final int ordersMonth;

  factory TeamMemberMetrics.fromJson(Map<String, dynamic> json) {
    return TeamMemberMetrics(
      assignedClinics: _readInt(json['assignedClinics']),
      coveragePercent: _readRatio(json['coveragePercent']),
      cadastroPercent: _readRatio(json['cadastroPercent']),
      ordersMonth: _readInt(json['ordersMonth']),
    );
  }
}

/// A row of the Equipe roster (spec 0014 §6).
class TeamMember {
  const TeamMember({
    required this.userId,
    required this.email,
    required this.roleName,
    required this.territories,
    required this.assignedClinicCount,
    this.name,
    this.avatarUrl,
    this.metrics,
    this.metricValue,
  });

  final int userId;
  final String? name;
  final String email;
  final String? avatarUrl;
  final String roleName;
  final List<({int id, String name})> territories;
  final int assignedClinicCount;

  /// The row's own figures, independent of the sort.
  ///
  /// The API always sends these; null here means an older build that predates
  /// them, which the row renders as "sem números" rather than as zeros it did
  /// not receive.
  final TeamMemberMetrics? metrics;

  /// The active sort metric's value, or null when it is not calculable. Only
  /// penetração and clínicas sem representante are not covered by [metrics].
  final double? metricValue;

  String get displayName => (name?.trim().isNotEmpty ?? false) ? name! : email;

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    return TeamMember(
      userId: readCrmId(json['userId'], 'userId'),
      name: json['name'] as String?,
      email: json['email'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      roleName: json['roleName'] as String? ?? '',
      territories: (json['territories'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (t) => (
              id: readCrmId(t['id'], 'id'),
              name: t['name'] as String? ?? '',
            ),
          )
          .toList(growable: false),
      assignedClinicCount: _readInt(json['assignedClinicCount']),
      metrics: json['metrics'] is Map<String, dynamic>
          ? TeamMemberMetrics.fromJson(json['metrics'] as Map<String, dynamic>)
          : null,
      metricValue: _readRatio(json['metricValue']),
    );
  }
}

/// A unit type with its subtypes — the catalog behind the `unit_type` filter.
/// One choice in a filter drawer (spec 0014 §5).
///
/// [parentIds] is what lets selection cascade: a municipality carries its
/// state, a rep carries the managers they report to. It is a list because a rep
/// may hold patches under two managers (spec 0009), so they stay selected while
/// either one is.
class FilterOption {
  const FilterOption({
    required this.id,
    required this.label,
    this.parentIds = const [],
  });

  final int id;
  final String label;
  final List<int> parentIds;

  factory FilterOption.fromJson(Map<String, dynamic> json) => FilterOption(
    id: readCrmId(json['id'], 'id'),
    // `name` is the unit-type catalogue's key; every faceted list uses `label`.
    label: (json['label'] ?? json['name']) as String? ?? '',
    parentIds: (json['parentIds'] as List<dynamic>? ?? const [])
        .map((raw) => readCrmId(raw, 'parentId'))
        .toList(growable: false),
  );
}

/// What each drawer can currently offer, given the scope and the other filters.
class DashboardFilterOptions {
  const DashboardFilterOptions({
    this.states = const [],
    this.municipalities = const [],
    this.managers = const [],
    this.reps = const [],
    this.unitTypes = const [],
  });

  final List<FilterOption> states;
  final List<FilterOption> municipalities;
  final List<FilterOption> managers;
  final List<FilterOption> reps;
  final List<FilterOption> unitTypes;

  static List<FilterOption> _list(dynamic raw) =>
      (raw as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(FilterOption.fromJson)
          .toList(growable: false);

  factory DashboardFilterOptions.fromJson(Map<String, dynamic> json) =>
      DashboardFilterOptions(
        states: _list(json['states']),
        municipalities: _list(json['municipalities']),
        managers: _list(json['managers']),
        reps: _list(json['reps']),
        unitTypes: _list(json['unitTypes']),
      );
}

/// The result of touching one drawer, once the cascade has been applied.
class CascadedSelection {
  const CascadedSelection({required this.parentIds, required this.childIds});

  final List<int> parentIds;
  final List<int> childIds;
}

/// Selecting a child selects its parents; clearing a parent drops its children.
///
/// Picking the *city* of Rio de Janeiro means the state of Rio de Janeiro is
/// part of what you are asking about, so the state selects with it — otherwise
/// the two drawers give contradictory answers to the same question. Clearing
/// the state has to drop the city, or the screen goes on filtering by a
/// municipality the user believes they cleared.
///
/// A child survives its parent's removal when *another* of its parents is still
/// selected — dead weight for geography, where a municipality has one state,
/// but a rep may report to two managers and dropping them because one was
/// cleared would be wrong.
///
/// A child whose parentage is unknown is kept. An unknown child is one the
/// narrowed option list no longer carries, and silently dropping it would
/// change a filter the user can no longer see to put back.
CascadedSelection cascadeSelection({
  required List<int> parentIds,
  required List<int> childIds,
  required List<FilterOption> children,
  required bool childChanged,
}) {
  final byChild = {for (final child in children) child.id: child.parentIds};

  if (childChanged) {
    final parents = {...parentIds};
    for (final childId in childIds) {
      parents.addAll(byChild[childId] ?? const []);
    }
    return CascadedSelection(
      parentIds: parents.toList(growable: false),
      childIds: List.unmodifiable(childIds),
    );
  }

  final parents = parentIds.toSet();
  final kept = childIds
      .where((childId) {
        final owners = byChild[childId];
        if (owners == null || owners.isEmpty) return true;
        return owners.any(parents.contains);
      })
      .toList(growable: false);

  return CascadedSelection(
    parentIds: parents.toList(growable: false),
    childIds: kept,
  );
}

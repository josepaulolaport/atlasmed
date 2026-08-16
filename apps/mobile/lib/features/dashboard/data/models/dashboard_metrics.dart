import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';

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
/// Counts per `purchase_funnel_stage`, and the three buckets the donut draws.
///
/// The API sends one count per stage and groups nothing — grouping is a
/// presentation choice and lives here. It used to arrive pre-grouped, which
/// cost two things: PURCHASE_WINDOW ("due to buy now") and OUTSIDE_WINDOW
/// ("recently served") were summed server-side even though a rep acts on them
/// differently, and no surface could draw the finer breakdown without an API
/// change. [stages] is there for the surface that wants it.
class DashboardBuckets {
  const DashboardBuckets({required this.stages, required this.total});

  /// Count per stage, keyed by API value, plus `UNKNOWN` for a profile the
  /// funnel has not calculated yet.
  final Map<String, int> stages;
  final int total;

  Map<String, int> get _grouped =>
      PurchaseBucketFilter.groupStageCounts(stages);

  int get active => _grouped[PurchaseBucketFilter.active] ?? 0;
  int get inactive => _grouped[PurchaseBucketFilter.inactive] ?? 0;
  int get neverBought => _grouped[PurchaseBucketFilter.neverBought] ?? 0;

  factory DashboardBuckets.fromJson(Map<String, dynamic> json) {
    final raw = json['stages'];
    final stages = <String, int>{};
    if (raw is Map<String, dynamic>) {
      for (final entry in raw.entries) {
        final value = entry.value;
        if (value is int) stages[entry.key] = value;
      }
    }
    return DashboardBuckets(stages: stages, total: _readInt(json['total']));
  }
}

/// CPF clinics needing attention (spec 0014 §4).
class DashboardCpfIssues {
  const DashboardCpfIssues({required this.missing, required this.invalid});

  /// No CPF on file: null, or blank once trimmed.
  final int missing;

  /// A CPF is on file but fails the modulo-11 check.
  final int invalid;

  int get total => missing + invalid;

  /// Nothing needs the rep's attention, so the card does not render.
  bool get isClear => total == 0;

  /// Zeros when the key is absent, so an older client against a newer API — or
  /// the reverse — degrades to "no warning" instead of throwing on a screen
  /// that has nothing to do with CPFs.
  factory DashboardCpfIssues.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const DashboardCpfIssues(missing: 0, invalid: 0);
    return DashboardCpfIssues(
      missing: _readInt(json['missing']),
      invalid: _readInt(json['invalid']),
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

class DashboardClinicPage {
  const DashboardClinicPage({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  final List<FacilityEntry> data;
  final int total;
  final int page;
  final int limit;

  bool get hasMore => page * limit < total;

  /// Where this page sits in the whole set — "26–50 de 146".
  ///
  /// Derived from `page` and `limit` rather than counted from `data`, which is
  /// what the pager did: `data.length` is 25 on every full page, so the label
  /// read identically no matter how far in you were.
  int get firstRowNumber => data.isEmpty ? 0 : (page - 1) * limit + 1;
  int get lastRowNumber => data.isEmpty ? 0 : (page - 1) * limit + data.length;

  /// Rows are Explorar's clinic payload, decoded by Explorar's own DTO.
  ///
  /// The breakdown used to carry a thinner shape of its own — id, name, city,
  /// stage, rep — and the screen grew a row to match it that only resembled
  /// Explorar's: same tile and title, no médicos count, no foco clínico, no
  /// status chips. Sharing the payload is what lets the two lists share the row.
  factory DashboardClinicPage.fromJson(Map<String, dynamic> json) {
    return DashboardClinicPage(
      data: (json['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((row) => FacilityEntry.fromDTO(FacilityDTO.fromMap(row)))
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
    this.ownerId,
    this.ownerName,
  });

  final int id;
  final String name;
  final Map<String, dynamic>? boundary;

  /// Who holds the zone. Only the admin's map resolves this — everywhere else
  /// the owner is the person whose desempenho is on screen, so there is nothing
  /// to distinguish.
  final int? ownerId;
  final String? ownerName;

  factory DashboardTerritoryFeature.fromJson(Map<String, dynamic> json) {
    final raw = json['boundary'];
    final owner = json['ownerId'];
    return DashboardTerritoryFeature(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      boundary: raw is Map<String, dynamic> ? raw : null,
      ownerId: owner == null ? null : readCrmId(owner, 'ownerId'),
      ownerName: json['ownerName'] as String?,
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

/// One person, as their profile reads them (spec 0015 §4).
///
/// Everything here is scoped to the reader: a manager sees the territories,
/// clinics and overrides that fall inside their own zones, so this agrees with
/// the roster row that opened it by construction.
class TeamMemberProfile {
  const TeamMemberProfile({
    required this.userId,
    required this.email,
    required this.roleName,
    required this.status,
    required this.memberSince,
    this.lastSeenAt,
    required this.territories,
    required this.assignedClinicCount,
    required this.outOfTerritoryCount,
    this.unassignedClinicCount,
    this.name,
    this.phoneNumber,
    this.avatarUrl,
  });

  final int userId;
  final String? name;
  final String email;
  final String? phoneNumber;
  final String? avatarUrl;
  final String roleName;
  final String status;
  final DateTime memberSince;

  /// The last time a person actually used the app. Null if never.
  ///
  /// Says the account is being used, not that the person is working — that is
  /// fieldwork, and app telemetry cannot stand in for it.
  final DateTime? lastSeenAt;
  final List<({int id, String name})> territories;
  final int assignedClinicCount;

  /// Clinics they hold that no patch of theirs covers — spec 0009 R2's
  /// override, reported for the first time.
  final int outOfTerritoryCount;

  /// Clinics in scope that nobody holds. Null for a rep: a clinic they do not
  /// hold is not in their denominator at all, so the gap is not theirs to answer
  /// for — it is their manager's.
  final int? unassignedClinicCount;

  String get displayName => (name?.trim().isNotEmpty ?? false) ? name! : email;

  bool get isRep => roleName == 'REP';

  factory TeamMemberProfile.fromJson(Map<String, dynamic> json) {
    return TeamMemberProfile(
      userId: readCrmId(json['userId'], 'userId'),
      name: json['name'] as String?,
      email: json['email'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      roleName: json['roleName'] as String? ?? '',
      status: json['status'] as String? ?? '',
      memberSince:
          DateTime.tryParse(json['memberSince'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      lastSeenAt: DateTime.tryParse(json['lastSeenAt'] as String? ?? ''),
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
      outOfTerritoryCount: _readInt(json["outOfTerritoryCount"]),
      unassignedClinicCount: json["unassignedClinicCount"] == null
          ? null
          : _readInt(json["unassignedClinicCount"]),
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

/// Someone invited to a team who has not accepted yet (spec 0015 R11).
///
/// Not a [TeamMember]: no user id, no clinics, no metrics. They occupy
/// territory before they exist as a user, which is exactly why the roster has
/// to show them — the clinics inside their staged patch are unstaffed and
/// nothing else says so.
class PendingInvite {
  const PendingInvite({
    required this.invitationId,
    required this.roleName,
    required this.territories,
    required this.expiresAt,
    this.name,
    this.email,
  });

  final int invitationId;
  final String? name;
  final String? email;
  final String roleName;
  final List<({int id, String name})> territories;
  final DateTime expiresAt;

  String get displayName =>
      (name?.trim().isNotEmpty ?? false) ? name! : (email ?? 'Convite');

  factory PendingInvite.fromJson(Map<String, dynamic> json) {
    return PendingInvite(
      invitationId: readCrmId(json['invitationId'], 'invitationId'),
      name: json['name'] as String?,
      email: json['email'] as String?,
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
      expiresAt:
          DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

/// A roster: the people on it, and the people arriving (spec 0015 R11).
class TeamRoster {
  const TeamRoster({required this.members, required this.pendingInvites});

  final List<TeamMember> members;
  final List<PendingInvite> pendingInvites;

  factory TeamRoster.fromJson(Map<String, dynamic> json) {
    return TeamRoster(
      members: (json['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TeamMember.fromJson)
          .toList(growable: false),
      pendingInvites: (json['pendingInvites'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PendingInvite.fromJson)
          .toList(growable: false),
    );
  }
}

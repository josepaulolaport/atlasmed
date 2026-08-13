import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';

/// Purchase-funnel counts for the Desempenho donut.
///
/// The API sends one count per funnel stage and groups nothing — grouping is a
/// presentation choice and lives here. `active` / `inactive` / `neverBought`
/// are derived, so a surface that wants the finer breakdown (say, splitting
/// "due to buy now" out of Ativas) can read [stages] directly without an API
/// change.
class DashboardPurchaseStatus {
  const DashboardPurchaseStatus({
    required this.stages,
    required this.total,
    required this.coveragePercent,
  });

  /// Count per `purchase_funnel_stage`, keyed by API value, plus `UNKNOWN`.
  final Map<String, int> stages;
  final int total;
  final int coveragePercent;

  int _stage(String key) => stages[key] ?? 0;

  int get neverPurchased => _stage('NEVER_PURCHASED');
  int get outsideWindow => _stage('OUTSIDE_WINDOW');
  int get purchaseWindow => _stage('PURCHASE_WINDOW');
  int get churn => _stage('CHURN');
  int get inactiveStage => _stage('INACTIVE');

  Map<String, int> get _grouped =>
      PurchaseBucketFilter.groupStageCounts(stages);

  int get active => _grouped[PurchaseBucketFilter.active] ?? 0;
  int get inactive => _grouped[PurchaseBucketFilter.inactive] ?? 0;
  int get neverBought => _grouped[PurchaseBucketFilter.neverBought] ?? 0;

  factory DashboardPurchaseStatus.fromJson(Map<String, dynamic> json) {
    final raw = json['stages'];
    final stages = <String, int>{};
    if (raw is Map<String, dynamic>) {
      for (final entry in raw.entries) {
        final value = entry.value;
        if (value is int) stages[entry.key] = value;
      }
    }
    return DashboardPurchaseStatus(
      stages: stages,
      total: json['total'] as int? ?? 0,
      coveragePercent: json['coveragePercent'] as int? ?? 0,
    );
  }
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

/// Visualisation mode for the territory card on the dashboard.
enum TerritoryMode {
  overview,
  assigned,
  empty;

  bool get showMap =>
      this == TerritoryMode.overview || this == TerritoryMode.assigned;

  static TerritoryMode fromJson(String value) {
    return switch (value) {
      'overview' => TerritoryMode.overview,
      'assigned' => TerritoryMode.assigned,
      'empty' || _ => TerritoryMode.empty,
    };
  }
}

class DashboardTerritorySummary {
  const DashboardTerritorySummary({
    required this.mode,
    required this.clinicCount,
    required this.doctorCount,
    required this.coveragePercent,
    required this.features,
    this.label,
  });

  final TerritoryMode mode;
  final String? label;
  final int clinicCount;
  final int doctorCount;
  final int coveragePercent;
  final List<DashboardTerritoryFeature> features;

  factory DashboardTerritorySummary.fromJson(Map<String, dynamic> json) {
    return DashboardTerritorySummary(
      mode: TerritoryMode.fromJson(json['mode'] as String? ?? 'empty'),
      label: json['label'] as String?,
      clinicCount: json['clinicCount'] as int? ?? 0,
      doctorCount: json['doctorCount'] as int? ?? 0,
      coveragePercent: json['coveragePercent'] as int? ?? 0,
      features: (json['features'] as List<dynamic>? ?? const [])
          .map(
            (e) =>
                DashboardTerritoryFeature.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
    );
  }
}

class DashboardSummary {
  const DashboardSummary({
    required this.purchaseStatus,
    required this.territory,
    this.verticalId,
  });

  /// Explicit filter when set; `null` = token-scoped union.
  final int? verticalId;
  final DashboardPurchaseStatus purchaseStatus;
  final DashboardTerritorySummary territory;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      verticalId: readCrmIdOrNull(json['verticalId'], 'verticalId'),
      purchaseStatus: DashboardPurchaseStatus.fromJson(
        json['purchaseStatus'] as Map<String, dynamic>,
      ),
      territory: DashboardTerritorySummary.fromJson(
        json['territory'] as Map<String, dynamic>,
      ),
    );
  }
}

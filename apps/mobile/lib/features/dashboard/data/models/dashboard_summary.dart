class DashboardPurchaseStatus {
  const DashboardPurchaseStatus({
    required this.active,
    required this.inactive,
    required this.neverBought,
    required this.total,
    required this.coveragePercent,
  });

  final int active;
  final int inactive;
  final int neverBought;
  final int total;
  final int coveragePercent;

  factory DashboardPurchaseStatus.fromJson(Map<String, dynamic> json) {
    return DashboardPurchaseStatus(
      active: json['active'] as int? ?? 0,
      inactive: json['inactive'] as int? ?? 0,
      neverBought: json['neverBought'] as int? ?? 0,
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

  final String id;
  final String name;
  final Map<String, dynamic>? boundary;

  factory DashboardTerritoryFeature.fromJson(Map<String, dynamic> json) {
    final raw = json['boundary'];
    return DashboardTerritoryFeature(
      id: json['id'] as String,
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

  bool get showMap => this == TerritoryMode.overview || this == TerritoryMode.assigned;

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
    required this.verticalId,
    required this.purchaseStatus,
    required this.territory,
  });

  final String verticalId;
  final DashboardPurchaseStatus purchaseStatus;
  final DashboardTerritorySummary territory;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      verticalId: json['verticalId'] as String,
      purchaseStatus: DashboardPurchaseStatus.fromJson(
        json['purchaseStatus'] as Map<String, dynamic>,
      ),
      territory: DashboardTerritorySummary.fromJson(
        json['territory'] as Map<String, dynamic>,
      ),
    );
  }
}

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
    this.metricValue,
  });

  final int userId;
  final String? name;
  final String email;
  final String? avatarUrl;
  final String roleName;
  final List<({int id, String name})> territories;
  final int assignedClinicCount;

  /// The active sort metric's value, or null when it is not calculable.
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
      metricValue: _readRatio(json['metricValue']),
    );
  }
}

/// A unit type with its subtypes — the catalog behind the `unit_type` filter.
class UnitTypeOption {
  const UnitTypeOption({required this.id, required this.name});

  final int id;
  final String name;

  factory UnitTypeOption.fromJson(Map<String, dynamic> json) => UnitTypeOption(
    id: readCrmId(json['id'], 'id'),
    name: json['name'] as String? ?? '',
  );
}

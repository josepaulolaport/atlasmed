import 'package:flutter/material.dart';

/// Desempenho "Status de Compras" — single UI convention for badges, filters,
/// donut, and `purchaseBucket` API drill-down.
///
/// Funnel stages on `facility_vertical_profiles.purchase_funnel_stage`, ordered
/// by how long it has been since the clinic last bought (`I` = its purchase
/// interval):
///
///   OUTSIDE_WINDOW   < 0.5×I   bought recently, not due yet
///   PURCHASE_WINDOW  < 2×I     due to buy now
///   CHURN            < 3×I     overdue, at risk
///   INACTIVE         ≥ 3×I     lapsed
///   NEVER_PURCHASED            no qualifying order, ever
///
/// Grouped for display as:
///   active      → OUTSIDE_WINDOW + PURCHASE_WINDOW
///   inactive    → CHURN + INACTIVE
///   neverBought → NEVER_PURCHASED (+ null/UNKNOWN on API counts)
///
/// The previous grouping put OUTSIDE_WINDOW under "Inativas" and INACTIVE under
/// "Nunca compraram", so a clinic that bought last week read as inactive, and a
/// clinic that bought for two years and stopped was indistinguishable from one
/// that never bought at all — which is precisely the clinic a rep needs to see
/// slipping.
abstract final class PurchaseBucketFilter {
  static const active = 'active';
  static const inactive = 'inactive';
  static const neverBought = 'neverBought';

  static const values = [active, inactive, neverBought];

  static const activeColor = Color(0xFF16a373);
  static const inactiveColor = Color(0xFFc6861b);
  static const neverColor = Color(0xFFdc2626);

  static String label(String value) => switch (value) {
    active => 'Ativas',
    inactive => 'Inativas',
    neverBought => 'Nunca compraram',
    _ => value,
  };

  /// Live-map filter chips (singular).
  static String mapLabel(String value) => switch (value) {
    active => 'Ativo',
    inactive => 'Inativo',
    neverBought => 'Sem compras',
    _ => value,
  };

  static Color color(String value) => switch (value) {
    active => activeColor,
    inactive => inactiveColor,
    neverBought => neverColor,
    _ => const Color(0xFF6b7280),
  };

  /// Live-map pin / cluster legend / filter chips — same palette as Desempenho.
  static const mapActiveColor = activeColor;
  static const mapInactiveColor = inactiveColor;
  static const mapNeverBoughtColor = neverColor;

  static Color mapColor(String value) => color(value);

  static Color backgroundColor(String value) =>
      color(value).withValues(alpha: 0.1);

  /// API funnel-stage values for a bucket (excludes null).
  static List<String> funnelApiValues(String bucket) => switch (bucket) {
    active => const ['OUTSIDE_WINDOW', 'PURCHASE_WINDOW'],
    inactive => const ['CHURN', 'INACTIVE'],
    neverBought => const ['NEVER_PURCHASED'],
    _ => const [],
  };

  /// Maps a raw funnel-stage API value onto the Desempenho bucket.
  static String? fromFunnelApi(String? apiValue) => switch (apiValue) {
    'OUTSIDE_WINDOW' || 'PURCHASE_WINDOW' => active,
    'CHURN' || 'INACTIVE' => inactive,
    'NEVER_PURCHASED' => neverBought,
    _ => null,
  };

  /// Groups per-stage counts from `GET /dashboard/summary` into the three
  /// display buckets. The API returns one count per stage and does no grouping
  /// of its own — see `PurchaseFunnelStageCounts` on the server.
  static Map<String, int> groupStageCounts(Map<String, int> stageCounts) {
    final grouped = <String, int>{active: 0, inactive: 0, neverBought: 0};
    for (final entry in stageCounts.entries) {
      // UNKNOWN (funnel not yet calculated) reads as "no purchase on record",
      // the same as NEVER_PURCHASED — never as a lapsed customer.
      final bucket = fromFunnelApi(entry.key) ?? neverBought;
      grouped[bucket] = (grouped[bucket] ?? 0) + entry.value;
    }
    return grouped;
  }

  static String? labelForFunnelApi(String? apiValue) {
    final bucket = fromFunnelApi(apiValue);
    return bucket == null ? null : label(bucket);
  }

  static Color? colorForFunnelApi(String? apiValue) {
    final bucket = fromFunnelApi(apiValue);
    return bucket == null ? null : color(bucket);
  }
}

import 'package:flutter/material.dart';

/// Desempenho "Status de Compras" — single UI convention for badges, filters,
/// donut, and `purchaseBucket` API drill-down.
///
/// Funnel stages on `facilities.purchase_funnel_stage`:
///   active      → PURCHASE_WINDOW
///   inactive    → OUTSIDE_WINDOW + CHURN
///   neverBought → NEVER_PURCHASED + INACTIVE (+ null on API counts)
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
    active => const ['PURCHASE_WINDOW'],
    inactive => const ['OUTSIDE_WINDOW', 'CHURN'],
    neverBought => const ['NEVER_PURCHASED', 'INACTIVE'],
    _ => const [],
  };

  /// Maps a raw funnel-stage API value onto the Desempenho bucket.
  static String? fromFunnelApi(String? apiValue) => switch (apiValue) {
    'PURCHASE_WINDOW' => active,
    'OUTSIDE_WINDOW' || 'CHURN' => inactive,
    'NEVER_PURCHASED' || 'INACTIVE' => neverBought,
    _ => null,
  };

  static String? labelForFunnelApi(String? apiValue) {
    final bucket = fromFunnelApi(apiValue);
    return bucket == null ? null : label(bucket);
  }

  static Color? colorForFunnelApi(String? apiValue) {
    final bucket = fromFunnelApi(apiValue);
    return bucket == null ? null : color(bucket);
  }
}

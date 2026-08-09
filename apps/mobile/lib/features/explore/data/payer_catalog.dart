import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Shared legend / editor colors for fontes pagadoras.
const payerShareColors = <Color>[
  AppColors.gray900,
  AppColors.green,
  AppColors.amber,
  AppColors.navyBright,
  AppColors.gray400,
  AppColors.purple,
];

Color payerShareColorForIndex(int i) =>
    payerShareColors[i % payerShareColors.length];

/// Catalog of healthcare providers available to add as fontes pagadoras.
class PayerCatalogEntry {
  const PayerCatalogEntry({
    required this.id,
    required this.name,
    this.type = 'PRIVATE',
  });

  final int id;
  final String name;

  /// `PRIVATE` | `PUBLIC` | `MIXED` | `OTHER`.
  final String type;
}

/// Builds the donut callout summary from the current share list.
///
/// [updatedAt] stays absent when the data source does not expose a timestamp.
PayerMixSummary? buildPayerMixSummary(
  List<PayerShare> payers, {
  DateTime? updatedAt,
}) {
  if (payers.isEmpty) return null;
  final sorted = [...payers]
    ..sort((a, b) => b.sharePercent.compareTo(a.sharePercent));
  final principal = sorted.first;
  return PayerMixSummary(
    principalSourceName: principal.name,
    principalSourcePercent: principal.sharePercent,
    registeredSourceCount: payers.length,
    updatedAt: updatedAt,
  );
}

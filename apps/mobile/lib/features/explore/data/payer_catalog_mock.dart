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

  final String id;
  final String name;

  /// `PRIVATE` | `PUBLIC` | `MIXED` | `OTHER`.
  final String type;
}

const mockPayerCatalog = <PayerCatalogEntry>[
  PayerCatalogEntry(id: 'hp-cat-1', name: 'Particular'),
  PayerCatalogEntry(id: 'hp-cat-2', name: 'SUS', type: 'PUBLIC'),
  PayerCatalogEntry(id: 'hp-cat-3', name: 'Outras', type: 'OTHER'),
  PayerCatalogEntry(id: 'hp-cat-4', name: 'Unimed'),
  PayerCatalogEntry(id: 'hp-cat-5', name: 'Bradesco Saúde'),
  PayerCatalogEntry(id: 'hp-cat-6', name: 'Sul América'),
  PayerCatalogEntry(id: 'hp-cat-7', name: 'Amil'),
  PayerCatalogEntry(id: 'hp-cat-8', name: 'Porto Seguro Saúde'),
  PayerCatalogEntry(id: 'hp-cat-9', name: 'NotreDame Intermédica'),
  PayerCatalogEntry(id: 'hp-cat-10', name: 'Hapvida'),
  PayerCatalogEntry(id: 'hp-cat-11', name: 'Prevent Senior'),
  PayerCatalogEntry(id: 'hp-cat-12', name: 'Alice'),
  PayerCatalogEntry(id: 'hp-cat-13', name: 'Care Plus'),
  PayerCatalogEntry(id: 'hp-cat-14', name: 'Sompo Saúde'),
  PayerCatalogEntry(id: 'hp-cat-15', name: 'Omint'),
];

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

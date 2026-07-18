import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Shared legend / editor colors for fontes pagadoras.
const payerShareColors = <Color>[
  Color(0xFF0f1729),
  Color(0xFF16a373),
  Color(0xFFeab308),
  Color(0xFF1e40af),
  Color(0xFF9ca3af),
  Color(0xFF7c3aed),
];

Color payerShareColorForIndex(int i) =>
    payerShareColors[i % payerShareColors.length];

/// Catalog of healthcare providers available to add as fontes pagadoras.
/// Phase 1 mock — Phase 3 wires to `GET /healthcare-providers` (or equivalent).
class PayerCatalogEntry {
  const PayerCatalogEntry({required this.id, required this.name});

  final String id;
  final String name;
}

const mockPayerCatalog = <PayerCatalogEntry>[
  PayerCatalogEntry(id: 'hp-cat-1', name: 'Particular'),
  PayerCatalogEntry(id: 'hp-cat-2', name: 'SUS'),
  PayerCatalogEntry(id: 'hp-cat-3', name: 'Outras'),
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
PayerMixSummary? buildPayerMixSummary(List<PayerShare> payers) {
  if (payers.isEmpty) return null;
  final sorted = [...payers]
    ..sort((a, b) => b.sharePercent.compareTo(a.sharePercent));
  final principal = sorted.first;
  return PayerMixSummary(
    principalSourceName: principal.name,
    principalSourcePercent: principal.sharePercent,
    registeredSourceCount: payers.length,
    updatedAt: DateTime.now(),
  );
}

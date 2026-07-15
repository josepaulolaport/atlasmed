// ── Price mode enum ─────────────────────────────────────────
enum PriceMode { catalog, custom }

extension PriceModeX on PriceMode {
  String get label {
    switch (this) {
      case PriceMode.catalog:
        return 'Catálogo';
      case PriceMode.custom:
        return 'Personalizado';
    }
  }

  String toJson() => name.toUpperCase();
}

PriceMode priceModeFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'CATALOG':
      return PriceMode.catalog;
    case 'CUSTOM':
      return PriceMode.custom;
    default:
      return PriceMode.catalog;
  }
}

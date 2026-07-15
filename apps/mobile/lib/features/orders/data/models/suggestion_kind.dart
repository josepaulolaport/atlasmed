// ── Suggestion kind enum ────────────────────────────────────
enum SuggestionKind { competitor, catalog, manual, historical }

extension SuggestionKindX on SuggestionKind {
  String get label {
    switch (this) {
      case SuggestionKind.competitor:
        return 'Concorrente';
      case SuggestionKind.catalog:
        return 'Catálogo';
      case SuggestionKind.manual:
        return 'Manual';
      case SuggestionKind.historical:
        return 'Histórico';
    }
  }

  String toJson() => name.toUpperCase();
}

SuggestionKind suggestionKindFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'COMPETITOR':
      return SuggestionKind.competitor;
    case 'CATALOG':
      return SuggestionKind.catalog;
    case 'MANUAL':
      return SuggestionKind.manual;
    case 'HISTORICAL':
      return SuggestionKind.historical;
    default:
      return SuggestionKind.catalog;
  }
}

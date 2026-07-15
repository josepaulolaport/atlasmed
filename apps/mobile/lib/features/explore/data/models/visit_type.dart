// ── Visit type enum ─────────────────────────────────────────
enum VisitType { visit, followup, presentation, order }

extension VisitTypeX on VisitType {
  String get label {
    switch (this) {
      case VisitType.visit:
        return 'Visita';
      case VisitType.followup:
        return 'Retorno';
      case VisitType.presentation:
        return 'Apresentação';
      case VisitType.order:
        return 'Entrega';
    }
  }

  String toJson() => name.toUpperCase();
}

VisitType visitTypeFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'VISIT':
      return VisitType.visit;
    case 'FOLLOWUP':
      return VisitType.followup;
    case 'PRESENTATION':
      return VisitType.presentation;
    case 'ORDER':
      return VisitType.order;
    default:
      return VisitType.visit;
  }
}

// ── Activity kind enum ──────────────────────────────────────
enum ActivityKind { visit, followup, order, download }

extension ActivityKindX on ActivityKind {
  String get label {
    switch (this) {
      case ActivityKind.visit:
        return 'Visita';
      case ActivityKind.followup:
        return 'Follow-up';
      case ActivityKind.order:
        return 'Pedido';
      case ActivityKind.download:
        return 'Download';
    }
  }

  String toJson() => name.toUpperCase();
}

ActivityKind activityKindFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'VISIT':
      return ActivityKind.visit;
    case 'FOLLOWUP':
      return ActivityKind.followup;
    case 'ORDER':
      return ActivityKind.order;
    case 'DOWNLOAD':
      return ActivityKind.download;
    default:
      return ActivityKind.visit;
  }
}

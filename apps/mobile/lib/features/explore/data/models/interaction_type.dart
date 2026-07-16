// ── Interaction type enum ───────────────────────────────────
enum InteractionType { followup, presentation }

extension InteractionTypeX on InteractionType {
  String get label {
    switch (this) {
      case InteractionType.followup:
        return 'Retorno';
      case InteractionType.presentation:
        return 'Apresentação';
    }
  }

  String toJson() => name;
}

InteractionType interactionTypeFromJson(String json) {
  switch (json.toLowerCase()) {
    case 'presentation':
      return InteractionType.presentation;
    case 'followup':
    default:
      return InteractionType.followup;
  }
}

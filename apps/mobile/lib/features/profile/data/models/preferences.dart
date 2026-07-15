// ── Preference item ──────────────────────────────────────────
class PreferenceItem {
  final String label;
  final String sub;
  final String kind;
  final bool value;
  final bool isLast;

  const PreferenceItem({
    required this.label,
    required this.sub,
    this.kind = 'chevron',
    this.value = false,
    this.isLast = false,
  });
}

// ── Preference item ──────────────────────────────────────────
class PreferenceItem {
  final String label;
  final String sub;
  final String kind;
  final bool value;
  final bool isLast;

  /// Set for rows that open something. Null leaves the row inert, which is
  /// what the notification toggles are until they are wired.
  final Future<void> Function()? onTap;

  const PreferenceItem({
    required this.label,
    required this.sub,
    this.kind = 'chevron',
    this.value = false,
    this.isLast = false,
    this.onTap,
  });
}

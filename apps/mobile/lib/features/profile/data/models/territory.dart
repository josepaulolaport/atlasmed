// ── Territory stats ──────────────────────────────────────────
class TerritoryStats {
  final int clinics;
  final int doctors;
  final int coveragePct;
  final int visitedThisWeek;
  final String coverageWeek;

  const TerritoryStats({
    this.clinics = 0,
    this.doctors = 0,
    this.coveragePct = 0,
    this.visitedThisWeek = 0,
    this.coverageWeek = 'esta semana',
  });
}

// ── Quick summary item ───────────────────────────────────────
class QuickSummaryItem {
  final String value;
  final String label;
  final String sub;
  final int color;

  const QuickSummaryItem({
    required this.value,
    required this.label,
    required this.sub,
    required this.color,
  });
}

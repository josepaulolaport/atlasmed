// ── Profile data models ─────────────────────────────────────

class UserProfile {
  final String id;
  final String displayName;
  final String initials;
  final String role;
  final String region;
  final String email;
  final String? phone;
  final String since;
  final double avatarHue;

  const UserProfile({
    required this.id,
    required this.displayName,
    required this.initials,
    required this.role,
    required this.region,
    required this.email,
    this.phone,
    this.since = '',
    this.avatarHue = 220,
  });
}

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

class PreferenceItem {
  final String label;
  final String sub;
  final String kind; // 'toggle' | 'chevron'
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

class RecentActivity {
  final String kind; // 'visit' | 'followup' | 'order' | 'download'
  final String title;
  final String detail;
  final String when;

  const RecentActivity({
    required this.kind,
    required this.title,
    required this.detail,
    required this.when,
  });
}

class SupportItem {
  final String label;
  final String? sub;
  final String kind; // 'help' | 'chat' | 'legal'

  const SupportItem({
    required this.label,
    this.sub,
    required this.kind,
  });
}

import 'activity_kind.dart';

// ── Recent activity ──────────────────────────────────────────
class RecentActivity {
  final ActivityKind kind;
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

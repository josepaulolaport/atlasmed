// ── User profile model ───────────────────────────────────────
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

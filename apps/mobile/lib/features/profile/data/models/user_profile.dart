// ── User profile model ───────────────────────────────────────
class UserProfile {
  final int id;
  final String displayName;
  final String initials;
  final String role;
  final String region;
  final String email;
  final String? phone;
  final String? username;

  /// The name as the account stores it, which is what the rename form edits.
  ///
  /// `displayName` is already assembled for reading and falls back to the
  /// e-mail when both halves are missing, so it cannot be typed back into a
  /// first/last pair without guessing where to split it.
  final String? firstName;
  final String? lastName;

  /// When the account was created, from `user.createdAt`.
  ///
  /// This used to default to an empty string that nothing ever filled in, so
  /// the footer silently dropped it on every build.
  final DateTime? memberSince;

  const UserProfile({
    required this.id,
    required this.displayName,
    required this.initials,
    required this.role,
    required this.region,
    required this.email,
    this.phone,
    this.username,
    this.firstName,
    this.lastName,
    this.memberSince,
  });
}

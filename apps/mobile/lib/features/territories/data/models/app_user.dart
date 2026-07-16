/// Which side of the territory hierarchy a user works on — a manager zone
/// needs a [manager], a rep patch needs a [rep]. Mirrors the real API's
/// `role.name` (`MANAGER` / `REP`), simplified to just the two roles this
/// app's assignment flows care about.
enum UserRole {
  manager,
  rep;

  String get label => this == UserRole.manager ? 'Gerente' : 'Representante';
}

/// A mock stand-in for the real `User` DTO (`id`, `firstName`/`lastName`,
/// `avatarUrl`, `role`) — trimmed to just what the assignment/search UI
/// needs. There's no `avatarUrl` here: avatars are rendered as initials
/// (see `UserAvatar`) rather than fetched images, so nothing here points
/// at a real image URL.
class AppUser {
  final String id;
  final String name;
  final UserRole role;

  /// The healthcare sector this person works in — used to keep the
  /// assignment/manager pickers scoped to sensible candidates instead of
  /// listing every user across every sector.
  final String sectorId;
  final bool isActive;

  const AppUser({
    required this.id,
    required this.name,
    required this.role,
    required this.sectorId,
    this.isActive = true,
  });
}

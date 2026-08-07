import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
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
  final int id;
  final String name;
  final UserRole role;

  /// The healthcare sector this person works in — used to keep the
  /// assignment/manager pickers scoped to sensible candidates instead of
  /// listing every user across every sector.
  ///
  /// `null` on the real API: `GET /access/users` doesn't return a
  /// per-user sector (it's a separate many-to-many assignment), so
  /// sector-scoping there happens via the `verticalId` query param instead
  /// of this field.
  final int? verticalId;
  final bool isActive;

  const AppUser({
    required this.id,
    required this.name,
    required this.role,
    this.verticalId,
    this.isActive = true,
  });

  /// Builds an [AppUser] from a `list-users.use-case.ts` `serializeUser`
  /// row (`GET /access/users`, `GET /access/users/:id`).
  factory AppUser.fromJson(Map<String, dynamic> json) {
    final firstName = json['firstName'] as String?;
    final lastName = json['lastName'] as String?;
    final combinedName = [
      firstName,
      lastName,
    ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');
    final username = json['username'] as String?;
    final email = json['email'] as String?;

    final roleName =
        ((json['role'] as Map<String, dynamic>?)?['name'] as String?)
            ?.toUpperCase();

    return AppUser(
      id: readCrmId(json['id'], 'id'),
      name: combinedName.isNotEmpty
          ? combinedName
          : (username?.isNotEmpty ?? false)
          ? username!
          : (email ?? ''),
      role: roleName == 'MANAGER' ? UserRole.manager : UserRole.rep,
      isActive: (json['status'] as String?)?.toUpperCase() == 'ACTIVE',
    );
  }
}

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:equatable/equatable.dart';

/// Sort field for `GET /access/users?sortBy=`.
enum UsersSortBy { name, role, status, createdAt }

extension UsersSortByX on UsersSortBy {
  String get apiValue => name;

  String get label {
    switch (this) {
      case UsersSortBy.name:
        return 'Nome';
      case UsersSortBy.role:
        return 'Função';
      case UsersSortBy.status:
        return 'Status';
      case UsersSortBy.createdAt:
        return 'Mais recentes';
    }
  }
}

/// Sort direction for `GET /access/users?sortDir=`.
enum UsersSortDir { asc, desc }

extension UsersSortDirX on UsersSortDir {
  String get apiValue => name;

  String labelFor(UsersSortBy sortBy) {
    switch (sortBy) {
      case UsersSortBy.name:
        return this == UsersSortDir.asc ? 'A–Z' : 'Z–A';
      case UsersSortBy.createdAt:
        return this == UsersSortDir.desc ? 'Mais recentes' : 'Mais antigos';
      case UsersSortBy.role:
      case UsersSortBy.status:
        return this == UsersSortDir.asc ? 'A–Z' : 'Z–A';
    }
  }
}

/// Search + filter + sort params for `GET /access/users`.
class UsersFilter extends Equatable {
  const UsersFilter({
    this.search = '',
    this.role,
    this.status,
    this.sortBy = UsersSortBy.createdAt,
    this.sortDir = UsersSortDir.desc,
  });

  final String search;
  final UserRoleName? role;
  final UserStatus? status;
  final UsersSortBy sortBy;
  final UsersSortDir sortDir;

  bool get hasCustomSort =>
      sortBy != UsersSortBy.createdAt || sortDir != UsersSortDir.desc;

  int get activeCount =>
      (role != null ? 1 : 0) +
      (status != null ? 1 : 0) +
      (hasCustomSort ? 1 : 0);

  UsersFilter copyWith({
    String? search,
    UserRoleName? role,
    UserStatus? status,
    UsersSortBy? sortBy,
    UsersSortDir? sortDir,
    bool clearRole = false,
    bool clearStatus = false,
  }) {
    return UsersFilter(
      search: search ?? this.search,
      role: clearRole ? null : (role ?? this.role),
      status: clearStatus ? null : (status ?? this.status),
      sortBy: sortBy ?? this.sortBy,
      sortDir: sortDir ?? this.sortDir,
    );
  }

  @override
  List<Object?> get props => [search, role, status, sortBy, sortDir];
}

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:equatable/equatable.dart';

/// Search + filter params for `GET /access/users`.
class UsersFilter extends Equatable {
  const UsersFilter({this.search = '', this.role, this.status});

  final String search;
  final UserRoleName? role;
  final UserStatus? status;

  int get activeCount => (role != null ? 1 : 0) + (status != null ? 1 : 0);

  UsersFilter copyWith({
    String? search,
    UserRoleName? role,
    UserStatus? status,
    bool clearRole = false,
    bool clearStatus = false,
  }) {
    return UsersFilter(
      search: search ?? this.search,
      role: clearRole ? null : (role ?? this.role),
      status: clearStatus ? null : (status ?? this.status),
    );
  }

  @override
  List<Object?> get props => [search, role, status];
}

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';

/// Records what the roster was asked for, and lets a test hold one reply open.
class FakeUsersRepository implements UsersRepository {
  final List<String?> searches = [];

  /// When set, the next `getUsers` returns this instead of resolving at once.
  Future<UsersPage>? nextResponse;
  bool fails = false;
  int total = 0;

  @override
  Future<UsersPage> getUsers({
    required int page,
    int limit = 20,
    String? search,
    UserRoleName? role,
    UserStatus? status,
    UsersSortBy sortBy = UsersSortBy.createdAt,
    UsersSortDir sortDir = UsersSortDir.desc,
  }) {
    searches.add(search);
    if (fails) return Future.error(StateError('offline'));
    final held = nextResponse;
    if (held != null) {
      nextResponse = null;
      return held;
    }
    return Future.value(
      UsersPage(items: const [], page: 1, totalPages: 1, total: total),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} is not used here');
}

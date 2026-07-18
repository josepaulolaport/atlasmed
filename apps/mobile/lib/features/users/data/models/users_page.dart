import 'package:atlasmed_mobile_app/core/user/models/user.dart';

/// Mirrors the `{ data, pagination }` envelope returned by
/// `GET /access/users`.
class UsersPage {
  const UsersPage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.total,
  });

  final List<User> items;
  final int page;
  final int totalPages;
  final int total;

  bool get hasMore => page < totalPages;
}

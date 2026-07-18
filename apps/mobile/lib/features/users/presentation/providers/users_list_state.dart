import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';

class UsersListState {
  const UsersListState({
    this.items = const [],
    this.loading = true,
    this.loadingMore = false,
    this.error,
    this.filter = const UsersFilter(),
    this.page = 1,
    this.totalPages = 1,
    this.total = 0,
  });

  final List<User> items;
  final bool loading;
  final bool loadingMore;
  final String? error;
  final UsersFilter filter;
  final int page;
  final int totalPages;
  final int total;

  bool get hasMore => page < totalPages;

  UsersListState copyWith({
    List<User>? items,
    bool? loading,
    bool? loadingMore,
    String? error,
    bool clearError = false,
    UsersFilter? filter,
    int? page,
    int? totalPages,
    int? total,
  }) {
    return UsersListState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      error: clearError ? null : (error ?? this.error),
      filter: filter ?? this.filter,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      total: total ?? this.total,
    );
  }
}

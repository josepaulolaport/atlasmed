import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_state.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Drives [UsersScreen]'s list: search + role/status filters, page-based
/// pagination against `GET /access/users`, and single-row refresh after a
/// lifecycle/role mutation elsewhere in the feature.
class UsersListNotifier extends StateNotifier<UsersListState> {
  UsersListNotifier(this._repository) : super(const UsersListState()) {
    load();
  }

  final UsersRepository _repository;
  static const _limit = 20;

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final result = await _repository.getUsers(
        page: 1,
        limit: _limit,
        search: state.filter.search.isEmpty ? null : state.filter.search,
        role: state.filter.role,
        status: state.filter.status,
        sortBy: state.filter.sortBy,
        sortDir: state.filter.sortDir,
      );
      state = state.copyWith(
        items: result.items,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        loading: false,
      );
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Não foi possível carregar os usuários.',
      );
    }
  }

  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore) return;
    state = state.copyWith(loadingMore: true);
    try {
      final result = await _repository.getUsers(
        page: state.page + 1,
        limit: _limit,
        search: state.filter.search.isEmpty ? null : state.filter.search,
        role: state.filter.role,
        status: state.filter.status,
        sortBy: state.filter.sortBy,
        sortDir: state.filter.sortDir,
      );
      state = state.copyWith(
        items: [...state.items, ...result.items],
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        loadingMore: false,
      );
    } catch (_) {
      state = state.copyWith(loadingMore: false);
    }
  }

  void setSearch(String search) {
    state = state.copyWith(filter: state.filter.copyWith(search: search));
    load();
  }

  /// Applies role/status/sort from the filter sheet in a single reload.
  void setFilter(UsersFilter filter) {
    state = state.copyWith(
      filter: filter.copyWith(search: state.filter.search),
    );
    load();
  }

  void clearFilters() {
    state = state.copyWith(filter: UsersFilter(search: state.filter.search));
    load();
  }

  /// Re-fetches a single row after a mutation (activate/deactivate/role
  /// change) made from the detail screen, so the list reflects it without a
  /// full reload.
  Future<void> refreshRow(String userId) async {
    final updated = await _repository.getUserById(userId);
    if (updated == null) return;
    state = state.copyWith(
      items: [
        for (final user in state.items)
          if (user.id == userId) updated else user,
      ],
    );
  }
}

final usersListProvider =
    StateNotifierProvider.autoDispose<UsersListNotifier, UsersListState>((ref) {
      return UsersListNotifier(ref.watch(usersRepositoryProvider));
    });

import 'dart:async';

import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_state.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Drives [UsersScreen]'s list: search + role/status filters, page-based
/// pagination against `GET /access/users`, and single-row refresh after a
/// lifecycle/role mutation elsewhere in the feature.
class UsersListNotifier extends StateNotifier<UsersListState>
    with DisposeSafeStateWrites<UsersListState> {
  UsersListNotifier(this._repository) : super(const UsersListState()) {
    load();
  }

  final UsersRepository _repository;
  static const _limit = 20;

  /// How long the typist gets between keystrokes before the roster is asked
  /// again. The same 350ms the assign-clinic search uses.
  static const searchDebounce = Duration(milliseconds: 350);

  Timer? _searchDebounce;

  /// Bumped on every first-page load. A response whose token is stale lost the
  /// race and is dropped: without this, typing "adriana" fired seven requests
  /// and whichever finished last won, so a slow reply for "adr" could land
  /// after the reply for the full word and overwrite it.
  int _loadToken = 0;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    final token = ++_loadToken;
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
      if (token != _loadToken) return;
      state = state.copyWith(
        items: result.items,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        loading: false,
      );
    } catch (_) {
      if (token != _loadToken) return;
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

  /// Debounced: this asked the API on every keystroke, so finding one person
  /// among hundreds cost a request per letter.
  void setSearch(String search) {
    state = state.copyWith(filter: state.filter.copyWith(search: search));
    _searchDebounce?.cancel();
    _searchDebounce = Timer(searchDebounce, load);
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
  Future<void> refreshRow(int userId) async {
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

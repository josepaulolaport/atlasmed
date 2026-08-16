import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/users_empty_state.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/users_filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

class UsersScreen extends ConsumerWidget {
  const UsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(canManageUsersProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AtlasAppBar(
        page: 'Usuários',
        actions: canManage
            ? [
                IconButton(
                  onPressed: () => const InvitationsRoute().push(context),
                  icon: const Icon(
                    Icons.mail_outline_rounded,
                    color: AppColors.gray900,
                  ),
                  tooltip: 'Ver convites',
                ),
              ]
            : null,
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Expanded(
              child: canManage ? const _UsersList() : const _AccessRestricted(),
            ),
          ],
        ),
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              onPressed: () => const InviteUserRoute().push(context),
              icon: const Icon(
                Icons.person_add_alt_1_rounded,
                color: Colors.white,
              ),
              label: const Text(
                'Convidar',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
    );
  }
}

class _AccessRestricted extends StatelessWidget {
  const _AccessRestricted();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline_rounded,
                size: 32,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Acesso restrito',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Somente administradores podem gerenciar usuários.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UsersList extends ConsumerStatefulWidget {
  const _UsersList();

  @override
  ConsumerState<_UsersList> createState() => _UsersListState();
}

class _UsersListState extends ConsumerState<_UsersList> {
  /// Owned here. The field built a fresh `TextEditingController.fromValue`
  /// inside `build`, so every keystroke allocated and abandoned one and forced
  /// the caret back to the end of the text — you could not edit the middle of
  /// what you had typed.
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(usersListProvider);
    final notifier = ref.read(usersListProvider.notifier);

    // Only when something else changed the term — clearing it, say. Writing
    // on every build is what moved the caret.
    if (_searchController.text != state.filter.search) {
      _searchController.text = state.filter.search;
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: _SearchBar(
            controller: _searchController,
            hasText: state.filter.search.isNotEmpty,
            filterCount: state.filter.activeCount,
            onChanged: notifier.setSearch,
            onFilter: () => _showFilterSheet(context, state, notifier),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${state.total} ${state.total == 1 ? "usuário" : "usuários"}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.gray400,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: state.loading
              ? ListView.builder(
                  itemCount: 8,
                  itemBuilder: (_, _) => const UsersSkeletonRow(),
                )
              // The notifier has always set `error` and nothing has ever
              // rendered it: a failed request fell through to the empty state,
              // so a dropped connection told an admin they had no users and
              // invited them to start inviting people.
              : state.error != null && state.items.isEmpty
              ? _UsersLoadFailed(onRetry: notifier.load)
              : state.items.isEmpty
              ? UsersEmptyState(query: state.filter.search)
              : NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    if (notification is ScrollEndNotification &&
                        state.hasMore &&
                        !state.loadingMore &&
                        notification.metrics.pixels >=
                            notification.metrics.maxScrollExtent - 200) {
                      notifier.loadMore();
                    }
                    return false;
                  },
                  child: RefreshIndicator(
                    onRefresh: notifier.load,
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      // Room for the "Convidar" button, which floats over this
                      // list and sat squarely on the last row's e-mail.
                      padding: const EdgeInsets.only(bottom: 88),
                      itemCount:
                          state.items.length + (state.loadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index >= state.items.length) {
                          return const UsersPaginationSkeletonRow();
                        }
                        final user = state.items[index];
                        return UserRow(
                          user: user,
                          onTap: () =>
                              UserDetailRoute(id: user.id).push(context),
                        );
                      },
                    ),
                  ),
                ),
        ),
      ],
    );
  }

  void _showFilterSheet(
    BuildContext context,
    UsersListState state,
    UsersListNotifier notifier,
  ) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) =>
          UsersFilterSheet(filter: state.filter, onApply: notifier.setFilter),
    );
  }
}

/// The roster could not be fetched — which is not the same as there being
/// nobody on it.
class _UsersLoadFailed extends StatelessWidget {
  const _UsersLoadFailed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.cloud_off_rounded,
                size: 32,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Não foi possível carregar os usuários',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Verifique a conexão e tente de novo.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              key: const Key('users-retry'),
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.hasText,
    required this.filterCount,
    required this.onChanged,
    required this.onFilter,
  });

  final TextEditingController controller;
  final bool hasText;
  final int filterCount;
  final ValueChanged<String> onChanged;
  final VoidCallback onFilter;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.gray200),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              children: [
                const SizedBox(width: 12),
                const Icon(
                  Icons.search_rounded,
                  size: 16,
                  color: AppColors.gray500,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    key: const Key('users-search'),
                    controller: controller,
                    onChanged: onChanged,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray900,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Buscar por nome, usuário ou email...',
                      hintStyle: TextStyle(color: AppColors.gray400),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                if (hasText)
                  GestureDetector(
                    onTap: () => onChanged(''),
                    child: Container(
                      width: 20,
                      height: 20,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: const BoxDecoration(
                        color: AppColors.gray200,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 10,
                        color: AppColors.gray500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: onFilter,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: filterCount > 0 ? AppColors.navyBright : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.gray200),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Stack(
              children: [
                Center(
                  child: Icon(
                    Icons.tune_rounded,
                    size: 18,
                    color: filterCount > 0
                        ? Colors.white
                        : AppColors.navyBright,
                  ),
                ),
                if (filterCount > 0)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 16),
                      height: 16,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: const BoxDecoration(
                        color: AppColors.rose,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '$filterCount',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

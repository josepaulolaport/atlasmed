import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/users_empty_state.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/users_filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class UsersScreen extends ConsumerWidget {
  const UsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(canManageUsersProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Stack(
              children: [
                const AtlasTopBar(page: 'Usuários'),
                if (canManage)
                  Positioned(
                    right: 6,
                    top: 0,
                    bottom: 0,
                    child: IconButton(
                      onPressed: () => context.push('/usuarios/convites'),
                      icon: const Icon(
                        Icons.mail_outline_rounded,
                        color: Color(0xFF0f1729),
                      ),
                      tooltip: 'Ver convites',
                    ),
                  ),
              ],
            ),
            Expanded(
              child: canManage ? const _UsersList() : const _AccessRestricted(),
            ),
          ],
        ),
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF0a2f7f),
              onPressed: () => context.push('/usuarios/convidar'),
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
                color: Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_outline_rounded,
                size: 32,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Acesso restrito',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Somente administradores podem gerenciar usuários.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF6b7280),
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
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(usersListProvider);
    final notifier = ref.read(usersListProvider.notifier);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: _SearchBar(
            value: state.filter.search,
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
                color: Color(0xFF9ca3af),
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
              : state.items.isEmpty
              ? UsersEmptyState(query: state.filter.search)
              : NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    if (notification is ScrollEndNotification &&
                        state.hasMore &&
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
                      itemCount: state.items.length + (state.hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index >= state.items.length) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF9ca3af),
                                ),
                              ),
                            ),
                          );
                        }
                        final user = state.items[index];
                        return UserRow(
                          user: user,
                          onTap: () => context.push('/usuarios/${user.id}'),
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
      builder: (_) => UsersFilterSheet(
        filter: state.filter,
        onApply: notifier.setFilter,
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.value,
    required this.filterCount,
    required this.onChanged,
    required this.onFilter,
  });

  final String value;
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
              border: Border.all(color: const Color(0xFFe5e7eb)),
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
                  color: Color(0xFF6b7280),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: TextEditingController.fromValue(
                      TextEditingValue(
                        text: value,
                        selection: TextSelection.collapsed(
                          offset: value.length,
                        ),
                      ),
                    ),
                    onChanged: onChanged,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF0f1729),
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Buscar por nome, usuário ou email...',
                      hintStyle: TextStyle(color: Color(0xFF9ca3af)),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                if (value.isNotEmpty)
                  GestureDetector(
                    onTap: () => onChanged(''),
                    child: Container(
                      width: 20,
                      height: 20,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: const BoxDecoration(
                        color: Color(0xFFe5e7eb),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 10,
                        color: Color(0xFF6b7280),
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
              color: filterCount > 0 ? const Color(0xFF1e40af) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFe5e7eb)),
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
                        : const Color(0xFF1e40af),
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
                        color: Color(0xFFe11d48),
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

import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/user_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/user_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Sentinel result of [UserPickerSheet.pickAssignee] meaning "explicitly
/// clear the current assignee" — distinct from a `null` `Future` result,
/// which means "the sheet was dismissed, leave things as they are".
const clearAssignee = '__clear_assignee__';

/// Draggable modal bottom sheet with a search field + avatar/name rows.
/// Used in two shapes (see the static helpers): picking a rep/manager to
/// assign to any territory, or picking which manager a rep patch reports
/// to (backed by [TerritoryRepository.getAssignableManagers]).
class UserPickerSheet extends ConsumerStatefulWidget {
  final String title;
  final UserRole role;
  final String? verticalId;

  /// The currently-selected id, used to show a checkmark and the "remove"
  /// button. A user id in the [pickAssignee] shape, a zone territory id
  /// in the [pickManagerForPatch] shape.
  final String? currentSelectionId;

  /// When set, candidates come from `getAssignableManagers(verticalId)`
  /// instead of `searchUsers`, and results resolve to a zone id.
  final bool pickingManagerZone;

  const UserPickerSheet({
    super.key,
    required this.title,
    required this.role,
    this.verticalId,
    this.currentSelectionId,
    this.pickingManagerZone = false,
  });

  /// Picks a rep/manager to assign to a territory. Returns the picked
  /// user's id, [clearAssignee] if the user tapped "Remover responsável",
  /// or `null` if the sheet was dismissed without a choice.
  static Future<String?> pickAssignee(
    BuildContext context, {
    required UserRole role,
    String? verticalId,
    String? currentUserId,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => UserPickerSheet(
        title: role == UserRole.manager
            ? 'Selecionar gerente'
            : 'Selecionar representante',
        role: role,
        verticalId: verticalId,
        currentSelectionId: currentUserId,
      ),
    );
  }

  /// Picks which manager a rep patch reports to. Returns the manager's
  /// zone territory id (`managerTerritoryId`), or `null` if dismissed.
  static Future<String?> pickManagerForPatch(
    BuildContext context, {
    String? currentManagerTerritoryId,
    String? verticalId,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => UserPickerSheet(
        title: 'Zona de gerente',
        role: UserRole.manager,
        verticalId: verticalId,
        currentSelectionId: currentManagerTerritoryId,
        pickingManagerZone: true,
      ),
    );
  }

  @override
  ConsumerState<UserPickerSheet> createState() => _UserPickerSheetState();
}

class _UserPickerSheetState extends ConsumerState<UserPickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.title,
                        style: const TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _query = value),
                  decoration: InputDecoration(
                    hintText: 'Buscar por nome...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    filled: true,
                    fillColor: const Color(0xFFF3F4F6),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              if (widget.currentSelectionId != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => Navigator.of(
                        context,
                      ).pop(widget.pickingManagerZone ? null : clearAssignee),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFFB91C1C),
                        padding: EdgeInsets.zero,
                      ),
                      child: Text(
                        widget.pickingManagerZone
                            ? 'Remover zona de gerente'
                            : 'Remover responsável',
                      ),
                    ),
                  ),
                ),
              const Divider(height: 1, color: Color(0xFFEEF0F3)),
              Expanded(child: _buildList(scrollController)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildList(ScrollController scrollController) {
    if (widget.pickingManagerZone) {
      return _buildManagerZoneList(scrollController);
    }
    return _buildUserList(scrollController);
  }

  Widget _buildUserList(ScrollController scrollController) {
    final future = ref
        .read(userRepositoryProvider)
        .searchUsers(
          role: widget.role,
          query: _query,
          verticalId: widget.verticalId,
        );

    return FutureBuilder<List<AppUser>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        final users = snapshot.data ?? const <AppUser>[];
        if (users.isEmpty) {
          return const _EmptyState(message: 'Nenhum usuário encontrado.');
        }
        return ListView.builder(
          controller: scrollController,
          padding: const EdgeInsets.symmetric(vertical: 6),
          itemCount: users.length,
          itemBuilder: (context, index) {
            final user = users[index];
            final selected = user.id == widget.currentSelectionId;
            return _UserRow(
              avatar: UserAvatar.forUser(user),
              title: user.name,
              subtitle: user.role.label,
              selected: selected,
              onTap: () => Navigator.of(context).pop(user.id),
            );
          },
        );
      },
    );
  }

  Widget _buildManagerZoneList(ScrollController scrollController) {
    final future = ref
        .read(territoryRepositoryProvider)
        .getAssignableManagers(verticalId: widget.verticalId);

    return FutureBuilder<List<AssignableManager>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        var candidates = snapshot.data ?? const <AssignableManager>[];
        if (_query.trim().isNotEmpty) {
          final needle = _query.trim().toLowerCase();
          candidates = candidates
              .where((c) => c.manager.name.toLowerCase().contains(needle))
              .toList();
        }
        if (candidates.isEmpty) {
          return const _EmptyState(
            message: 'Nenhum gerente com zona ativa neste vertical.',
          );
        }
        return ListView.builder(
          controller: scrollController,
          padding: const EdgeInsets.symmetric(vertical: 6),
          itemCount: candidates.length,
          itemBuilder: (context, index) {
            final candidate = candidates[index];
            final selected =
                candidate.zoneTerritoryId == widget.currentSelectionId;
            return _UserRow(
              avatar: UserAvatar.forUser(candidate.manager),
              title: candidate.manager.name,
              subtitle: candidate.zoneName,
              selected: selected,
              onTap: () => Navigator.of(context).pop(candidate.zoneTerritoryId),
            );
          },
        );
      },
    );
  }
}

class _UserRow extends StatelessWidget {
  final Widget avatar;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  const _UserRow({
    required this.avatar,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        child: Row(
          children: [
            avatar,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, color: Color(0xFF0A2F7F)),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;

  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF6B7280)),
        ),
      ),
    );
  }
}

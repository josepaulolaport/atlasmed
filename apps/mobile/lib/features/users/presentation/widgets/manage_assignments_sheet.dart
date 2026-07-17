import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Bottom sheet to manage a user's manager / territory / sector
/// assignments. Mirrors the web app's `ManageAssignmentsDialog` —
/// `PATCH /access/users/:id/manager`,
/// `POST`/`DELETE /access/users/:id/territories`,
/// `POST`/`DELETE /access/users/:id/sectors`.
class ManageAssignmentsSheet extends ConsumerStatefulWidget {
  const ManageAssignmentsSheet({
    super.key,
    required this.user,
    required this.assignments,
  });

  final User user;
  final UserAssignments assignments;

  static Future<void> show(
    BuildContext context, {
    required User user,
    required UserAssignments assignments,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) =>
          ManageAssignmentsSheet(user: user, assignments: assignments),
    );
  }

  @override
  ConsumerState<ManageAssignmentsSheet> createState() =>
      _ManageAssignmentsSheetState();
}

class _ManageAssignmentsSheetState
    extends ConsumerState<ManageAssignmentsSheet> {
  late UserAssignments _assignments;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _assignments = widget.assignments;
  }

  Future<void> _reload() async {
    final updated = await ref
        .read(usersRepositoryProvider)
        .getUserAssignments(widget.user.id);
    if (mounted) setState(() => _assignments = updated);
  }

  Future<void> _runAction(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível concluir a ação.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repository = ref.read(usersRepositoryProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.92,
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
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Atribuições · ${widget.user.displayName}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
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
              if (_busy) const LinearProgressIndicator(minHeight: 2),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  children: [
                    if (widget.user.role.name == UserRoleName.rep) ...[
                      _ManagerSection(
                        assignments: _assignments,
                        busy: _busy,
                        onPick: () => _pickManager(repository),
                        onClear: () => _runAction(
                          () => repository.assignManager(widget.user.id, null),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    _OptionListSection(
                      title: 'Territórios',
                      assignedLabels: _assignments.territories
                          .map(
                            (t) => (id: t.territoryId, name: t.territoryName),
                          )
                          .toList(),
                      onAdd: () => _pickTerritory(repository),
                      onRemove: (id) => _runAction(
                        () => repository.revokeTerritory(widget.user.id, id),
                      ),
                      busy: _busy,
                    ),
                    const SizedBox(height: 20),
                    _OptionListSection(
                      title: 'Setores',
                      assignedLabels: _assignments.sectors
                          .map((s) => (id: s.sectorId, name: s.sectorName))
                          .toList(),
                      onAdd: () => _pickSector(repository),
                      onRemove: (id) => _runAction(
                        () => repository.revokeSector(widget.user.id, id),
                      ),
                      busy: _busy,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _pickManager(UsersRepository repository) async {
    final options = await repository.getManagerOptions();
    if (!mounted) return;
    final picked = await _showOptionPicker(
      title: 'Selecionar gerente',
      options: options.map((o) => (id: o.id, name: o.name)).toList(),
      currentId: _assignments.managerId,
    );
    if (picked != null) {
      await _runAction(() => repository.assignManager(widget.user.id, picked));
    }
  }

  Future<void> _pickTerritory(UsersRepository repository) async {
    final options = await repository.getTerritoryOptions();
    final assignedIds = _assignments.territories
        .map((t) => t.territoryId)
        .toSet();
    final available = options
        .where((o) => !assignedIds.contains(o.id))
        .toList();
    if (!mounted) return;
    final picked = await _showOptionPicker(
      title: 'Adicionar território',
      options: available.map((o) => (id: o.id, name: o.name)).toList(),
      currentId: null,
    );
    if (picked != null) {
      await _runAction(
        () => repository.assignTerritory(widget.user.id, picked),
      );
    }
  }

  Future<void> _pickSector(UsersRepository repository) async {
    final options = await repository.getSectors();
    final assignedIds = _assignments.sectors.map((s) => s.sectorId).toSet();
    final available = options
        .where((o) => !assignedIds.contains(o.id))
        .toList();
    if (!mounted) return;
    final picked = await _showOptionPicker(
      title: 'Adicionar setor',
      options: available.map((o) => (id: o.id, name: o.name)).toList(),
      currentId: null,
    );
    if (picked != null) {
      await _runAction(() => repository.assignSector(widget.user.id, picked));
    }
  }

  Future<String?> _showOptionPicker({
    required String title,
    required List<({String id, String name})> options,
    required String? currentId,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (options.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  'Nenhuma opção disponível.',
                  style: TextStyle(color: Color(0xFF6b7280)),
                ),
              )
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: ListView(
                  shrinkWrap: true,
                  children: options
                      .map(
                        (o) => ListTile(
                          title: Text(o.name),
                          trailing: o.id == currentId
                              ? const Icon(
                                  Icons.check_circle,
                                  color: Color(0xFF0A2F7F),
                                )
                              : null,
                          onTap: () => Navigator.of(sheetContext).pop(o.id),
                        ),
                      )
                      .toList(),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _ManagerSection extends StatelessWidget {
  const _ManagerSection({
    required this.assignments,
    required this.busy,
    required this.onPick,
    required this.onClear,
  });

  final UserAssignments assignments;
  final bool busy;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Gerente',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6b7280),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: busy ? null : onPick,
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                ),
                child: Text(assignments.managerName ?? 'Selecionar gerente'),
              ),
            ),
            if (assignments.managerId != null) ...[
              const SizedBox(width: 8),
              IconButton(
                onPressed: busy ? null : onClear,
                icon: const Icon(
                  Icons.close,
                  size: 18,
                  color: Color(0xFFB91C1C),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _OptionListSection extends StatelessWidget {
  const _OptionListSection({
    required this.title,
    required this.assignedLabels,
    required this.onAdd,
    required this.onRemove,
    required this.busy,
  });

  final String title;
  final List<({String id, String name})> assignedLabels;
  final VoidCallback onAdd;
  final void Function(String id) onRemove;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6b7280),
              ),
            ),
            TextButton.icon(
              onPressed: busy ? null : onAdd,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Adicionar'),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (assignedLabels.isEmpty)
          const Text(
            'Nenhum item atribuído.',
            style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
          )
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: assignedLabels
                .map(
                  (item) => Chip(
                    label: Text(
                      item.name,
                      style: const TextStyle(fontSize: 12),
                    ),
                    onDeleted: busy ? null : () => onRemove(item.id),
                    backgroundColor: const Color(0xFFf3f4f6),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }
}

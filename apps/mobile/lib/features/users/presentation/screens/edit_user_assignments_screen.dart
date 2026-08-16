import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Manage which sectors are assigned to a user.
///
/// Manager and territory picks happen on each sector card on the user detail
/// screen — this screen only toggles sector membership.
class EditUserAssignmentsScreen extends ConsumerStatefulWidget {
  const EditUserAssignmentsScreen({super.key, required this.userId});

  final int userId;

  @override
  ConsumerState<EditUserAssignmentsScreen> createState() =>
      _EditUserAssignmentsScreenState();
}

class _EditUserAssignmentsScreenState
    extends ConsumerState<EditUserAssignmentsScreen> {
  final Map<int, InviteVerticalAssignment> _verticalAssignments = {};

  /// Sectors the admin unchecked in this session, kept whole.
  ///
  /// Unchecking used to drop the assignment on the floor, so re-checking it
  /// built a bare one with no manager and no territories — the toggle was not
  /// reversible even before saving, and the loss only showed up after.
  final Map<int, InviteVerticalAssignment> _detached = {};

  /// What was loaded, so back can tell an edited screen from an untouched one.
  Set<int>? _initialIds;

  User? _user;
  bool _loading = true;
  bool _submitting = false;
  Object? _loadError;

  List<InviteVerticalAssignment> get _orderedAssignments =>
      _verticalAssignments.values.toList(growable: false);

  bool get _isDirty {
    final initial = _initialIds;
    if (initial == null) return false;
    final current = _verticalAssignments.keys.toSet();
    return current.length != initial.length || !current.containsAll(initial);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(usersRepositoryProvider);
      final user = await repo.getUserById(widget.userId);
      final assignments = await repo.getUserAssignments(widget.userId);
      if (!mounted) return;
      if (user == null) {
        setState(() {
          _loading = false;
          _loadError = StateError('User not found');
        });
        return;
      }
      setState(() {
        _user = user;
        _verticalAssignments
          ..clear()
          ..addEntries(
            assignments.verticalAssignments.map(
              (a) => MapEntry(a.verticalId, a),
            ),
          );
        _detached.clear();
        _initialIds = _verticalAssignments.keys.toSet();
        _loading = false;
        _loadError = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final canAdmin = ref.watch(canManageUserAdminProvider);
    if (!canAdmin) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
              const Expanded(
                child: Center(
                  child: Text(
                    'Acesso restrito.',
                    style: TextStyle(color: AppColors.gray500),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final sectorsAsync = ref.watch(verticalOptionsProvider);

    // canPop stays false and _handleBack decides: the chips change state
    // through setState, but keeping the two in sync here costs nothing and
    // _handleBack pops straight through when nothing was touched.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _handleBack,
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: AppColors.gray900,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        _user == null
                            ? 'Gerenciar linhas comerciais'
                            : 'Linhas · ${_user!.displayName}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(child: _buildBody(sectorsAsync)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AsyncValue<List<VerticalOption>> sectorsAsync) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null || _user == null) {
      // A missing user and a dropped connection are not the same problem, and
      // the screen offered no way out of either.
      final notFound = _loadError is StateError;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                notFound
                    ? 'Usuário não encontrado.'
                    : 'Não foi possível carregar as linhas comerciais.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.gray500),
              ),
              if (!notFound) ...[
                const SizedBox(height: 12),
                OutlinedButton(
                  key: const Key('assignments-retry'),
                  onPressed: () {
                    setState(() {
                      _loading = true;
                      _loadError = null;
                    });
                    _load();
                  },
                  child: const Text('Tentar de novo'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    final showAssignments =
        _user!.role.name == UserRoleName.rep ||
        _user!.role.name == UserRoleName.manager;

    if (!showAssignments) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Esta função não possui linhas comerciais atribuíveis.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.gray500),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        const Text(
          'Selecione as linhas comerciais deste usuário. Gerente e '
          'territórios são definidos em cada card na ficha do usuário.',
          style: TextStyle(
            fontSize: 13.5,
            color: AppColors.gray500,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Linhas comerciais',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray500,
          ),
        ),
        const SizedBox(height: 8),
        sectorsAsync.when(
          loading: () => const CircularProgressIndicator(),
          error: (_, _) =>
              const Text('Não foi possível carregar as linhas comerciais.'),
          data: (sectors) => Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sectors.map((sector) {
              final selected = _verticalAssignments.containsKey(sector.id);
              return FilterChip(
                label: Text(sector.name),
                selected: selected,
                onSelected: (value) => _toggleSector(sector, value),
                selectedColor: AppColors.navyDeep.withValues(alpha: 0.12),
                checkmarkColor: AppColors.navyDeep,
                labelStyle: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? AppColors.navyDeep : AppColors.gray700,
                ),
                side: BorderSide(
                  color: selected ? AppColors.navyDeep : AppColors.gray200,
                ),
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.navyDeep,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Salvar linhas'),
          ),
        ),
      ],
    );
  }

  Future<void> _toggleSector(VerticalOption sector, bool selected) async {
    if (selected) {
      setState(() {
        // Prefer what this sector had before it was unchecked. Rebuilding a
        // bare assignment here is what silently dropped the manager and the
        // territories on an off-then-on toggle.
        final restored = _detached.remove(sector.id);
        _verticalAssignments[sector.id] =
            restored ??
            InviteVerticalAssignment(
              verticalId: sector.id,
              verticalName: sector.name,
            );
      });
      return;
    }

    final existing = _verticalAssignments[sector.id];
    if (existing != null && _carriesWork(existing)) {
      final confirmed = await _confirmRemoval(sector.name, existing);
      if (confirmed != true || !mounted) return;
    }

    setState(() {
      final removed = _verticalAssignments.remove(sector.id);
      if (removed != null) _detached[sector.id] = removed;
    });
  }

  /// Whether unchecking this sector would throw away more than membership.
  bool _carriesWork(InviteVerticalAssignment assignment) =>
      assignment.territories.isNotEmpty ||
      assignment.managerName != null ||
      assignment.newPatch != null;

  /// Saving after unchecking a sector wipes its manager and its territories,
  /// and nothing said so — the chip looked like a filter.
  Future<bool?> _confirmRemoval(
    String sectorName,
    InviteVerticalAssignment assignment,
  ) {
    final territoryCount = assignment.territories.length;
    final losses = <String>[
      if (assignment.managerName != null) 'o gerente',
      if (territoryCount == 1)
        'o território'
      else if (territoryCount > 1)
        'os $territoryCount territórios',
    ];

    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Remover $sectorName?'),
        content: Text(
          losses.isEmpty
              ? 'Ao salvar, esta linha comercial sai do usuário.'
              : 'Ao salvar, ${losses.join(' e ')} desta linha '
                    'também ${losses.length == 1 ? 'sai' : 'saem'} do usuário. '
                    'Para devolver depois será preciso atribuir de novo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            key: const Key('assignments-remove-confirm'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
  }

  /// Back dropped every toggle without a word.
  Future<void> _handleBack() async {
    if (!_isDirty) {
      context.pop();
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Descartar alterações?'),
        content: const Text('As linhas que você mudou não foram salvas.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Continuar editando'),
          ),
          TextButton(
            key: const Key('assignments-discard'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) {
      context.pop();
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(usersRepositoryProvider)
          .replaceVerticalAssignments(widget.userId, _orderedAssignments);
      ref.invalidate(userAssignmentsProvider(widget.userId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Linhas comerciais atualizadas.')),
        );
        context.pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is UsersApiException && error.statusCode == 403
                  ? 'Você não pode alterar as linhas deste usuário.'
                  : 'Não foi possível salvar as linhas comerciais.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

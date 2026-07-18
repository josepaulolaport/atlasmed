import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Manage which sectors are assigned to a user.
///
/// Manager and territory picks happen on each sector card on the user detail
/// screen — this screen only toggles sector membership.
class EditUserAssignmentsScreen extends ConsumerStatefulWidget {
  const EditUserAssignmentsScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<EditUserAssignmentsScreen> createState() =>
      _EditUserAssignmentsScreenState();
}

class _EditUserAssignmentsScreenState
    extends ConsumerState<EditUserAssignmentsScreen> {
  final Map<String, InviteSectorAssignment> _sectorAssignments = {};
  User? _user;
  bool _loading = true;
  bool _submitting = false;
  Object? _loadError;

  List<InviteSectorAssignment> get _orderedAssignments =>
      _sectorAssignments.values.toList(growable: false);

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
        _sectorAssignments
          ..clear()
          ..addEntries(
            assignments.sectorAssignments.map((a) => MapEntry(a.sectorId, a)),
          );
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
    final sectorsAsync = ref.watch(sectorOptionsProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      _user == null
                          ? 'Gerenciar setores'
                          : 'Setores · ${_user!.displayName}',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
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
    );
  }

  Widget _buildBody(AsyncValue<List<SectorOption>> sectorsAsync) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null || _user == null) {
      return const Center(
        child: Text(
          'Não foi possível carregar os setores.',
          style: TextStyle(color: Color(0xFF6b7280)),
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
            'Esta função não possui setores atribuíveis.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6b7280)),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        const Text(
          'Selecione os setores deste usuário. Gerente e territórios '
          'são definidos em cada card na ficha do usuário.',
          style: TextStyle(
            fontSize: 13.5,
            color: Color(0xFF6b7280),
            height: 1.35,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Setores',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6b7280),
          ),
        ),
        const SizedBox(height: 8),
        sectorsAsync.when(
          loading: () => const CircularProgressIndicator(),
          error: (_, _) => const Text('Não foi possível carregar os setores.'),
          data: (sectors) => Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sectors.map((sector) {
              final selected = _sectorAssignments.containsKey(sector.id);
              return FilterChip(
                label: Text(sector.name),
                selected: selected,
                onSelected: (value) {
                  setState(() {
                    if (value) {
                      _sectorAssignments.putIfAbsent(
                        sector.id,
                        () => InviteSectorAssignment(
                          sectorId: sector.id,
                          sectorName: sector.name,
                        ),
                      );
                    } else {
                      _sectorAssignments.remove(sector.id);
                    }
                  });
                },
                selectedColor: const Color(0xFF0a2f7f).withValues(alpha: 0.12),
                checkmarkColor: const Color(0xFF0a2f7f),
                labelStyle: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? const Color(0xFF0a2f7f)
                      : const Color(0xFF374151),
                ),
                side: BorderSide(
                  color: selected
                      ? const Color(0xFF0a2f7f)
                      : const Color(0xFFe5e7eb),
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
              backgroundColor: const Color(0xFF0a2f7f),
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
                : const Text('Salvar setores'),
          ),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(usersRepositoryProvider)
          .replaceSectorAssignments(widget.userId, _orderedAssignments);
      ref.invalidate(userAssignmentsProvider(widget.userId));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Setores atualizados.')));
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível salvar os setores.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

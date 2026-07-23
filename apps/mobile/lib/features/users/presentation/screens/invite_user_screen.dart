import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manager_picker_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Create a new invite, or edit a pending one.
///
/// Review / read-only lives on [InvitationDetailScreen]. This screen is only
/// for create + edit form flows.
class InviteUserScreen extends ConsumerStatefulWidget {
  const InviteUserScreen({super.key, this.invitationId});

  final String? invitationId;

  @override
  ConsumerState<InviteUserScreen> createState() => _InviteUserScreenState();
}

class _InviteUserScreenState extends ConsumerState<InviteUserScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  DateTime? _birthDate;

  UserRole? _selectedRole;
  UserInvitation? _invitation;

  /// Per-sector drafts keyed by sector id — populated when a sector chip is
  /// selected; each holds that sector's manager (REP) + territories.
  final Map<String, InviteSectorAssignment> _sectorAssignments = {};
  bool _submitting = false;
  bool _loadingInvitation = false;
  Object? _loadError;
  bool _hydrated = false;

  bool get _isExisting => widget.invitationId != null;

  bool get _needsManager => _selectedRole?.name == UserRoleName.rep;

  bool get _needsTerritory =>
      _selectedRole?.name == UserRoleName.rep ||
      _selectedRole?.name == UserRoleName.manager;

  bool get _needsSectors =>
      _selectedRole != null && _selectedRole!.name != UserRoleName.admin;

  List<InviteSectorAssignment> get _orderedAssignments =>
      _sectorAssignments.values.toList(growable: false);

  @override
  void initState() {
    super.initState();
    if (_isExisting) {
      _loadingInvitation = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadInvitation());
    }
  }

  Future<void> _loadInvitation() async {
    final id = widget.invitationId;
    if (id == null) return;
    try {
      final invitation = await ref
          .read(invitationsRepositoryProvider)
          .getInvitation(id);
      if (!mounted) return;
      if (!invitation.status.isEditable) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Este convite não pode mais ser editado.'),
          ),
        );
        context.pop();
        return;
      }
      setState(() {
        _invitation = invitation;
        _emailController.text = invitation.email;
        _firstNameController.text = invitation.firstName ?? '';
        _lastNameController.text = invitation.lastName ?? '';
        _phoneController.text = invitation.phoneNumber ?? '';
        _birthDate = invitation.birthDate;
        _sectorAssignments
          ..clear()
          ..addEntries(
            invitation.sectorAssignments.map((a) => MapEntry(a.sectorId, a)),
          );
        _loadingInvitation = false;
        _loadError = null;
        _hydrated = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingInvitation = false;
        _loadError = error;
      });
    }
  }

  void _hydrateRoleIfNeeded(List<UserRole> roles) {
    if (_hydrated || _invitation == null) return;
    final roleId = _invitation!.roleId;
    UserRole? match;
    if (roleId != null) {
      for (final role in roles) {
        if (role.id == roleId) {
          match = role;
          break;
        }
      }
    }
    if (match == null) {
      for (final role in roles) {
        if (role.name.name.toUpperCase() == _invitation!.roleName) {
          match = role;
          break;
        }
      }
    }
    if (match == null) return;
    _hydrated = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _selectedRole = match);
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String get _title => _isExisting ? 'Editar convite' : 'Convidar usuário';

  @override
  Widget build(BuildContext context) {
    final rolesAsync = ref.watch(rolesProvider);
    final sectorsAsync = ref.watch(sectorOptionsProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                      _title,
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
            Expanded(child: _buildBody(rolesAsync, sectorsAsync)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(
    AsyncValue<List<UserRole>> rolesAsync,
    AsyncValue<List<SectorOption>> sectorsAsync,
  ) {
    if (_loadingInvitation) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null) {
      return const Center(
        child: Text(
          'Não foi possível carregar o convite.',
          style: TextStyle(color: Color(0xFF6b7280)),
        ),
      );
    }

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          _FieldLabel('Nome'),
          const SizedBox(height: 6),
          TextFormField(
            controller: _firstNameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(hintText: 'Nome', isDense: true),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Informe o nome.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _FieldLabel('Sobrenome'),
          const SizedBox(height: 6),
          TextFormField(
            controller: _lastNameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              hintText: 'Sobrenome',
              isDense: true,
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Informe o sobrenome.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _FieldLabel('Data de nascimento'),
          const SizedBox(height: 6),
          OutlinedButton(
            onPressed: _pickBirthDate,
            style: OutlinedButton.styleFrom(
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            ),
            child: Text(
              _birthDate == null ? 'Selecionar data' : formatDate(_birthDate!),
              style: TextStyle(
                color: _birthDate == null
                    ? const Color(0xFF9ca3af)
                    : const Color(0xFF0f1729),
              ),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'O convidado precisará confirmar esta data no cadastro.',
            style: TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
          ),
          const SizedBox(height: 16),
          _FieldLabel('Email'),
          const SizedBox(height: 6),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'nome@empresa.com.br',
              isDense: true,
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Informe um email.';
              }
              if (!value.contains('@')) return 'Email inválido.';
              return null;
            },
          ),
          const SizedBox(height: 16),
          _FieldLabel('Telefone'),
          const SizedBox(height: 6),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              hintText: '+55 11 99999-0000',
              isDense: true,
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Informe o telefone.';
              }
              final digits = value.replaceAll(RegExp(r'\D'), '');
              if (digits.length < 10) {
                return 'Telefone inválido.';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          _FieldLabel('Função'),
          const SizedBox(height: 8),
          rolesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => const Text(
              'Não foi possível carregar as funções.',
              style: TextStyle(color: Color(0xFF6b7280)),
            ),
            data: (roles) {
              _hydrateRoleIfNeeded(roles);
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: roles.map((role) {
                  final selected = _selectedRole?.id == role.id;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _selectedRole = role;
                      _sectorAssignments.clear();
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: selected
                            ? role.name.color.withValues(alpha: 0.12)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: selected
                              ? role.name.color
                              : const Color(0xFFe5e7eb),
                        ),
                      ),
                      child: Text(
                        role.name.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: selected
                              ? role.name.color
                              : const Color(0xFF374151),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
          if (_needsSectors) ...[
            const SizedBox(height: 20),
            _FieldLabel('Setores'),
            const SizedBox(height: 8),
            sectorsAsync.when(
              loading: () => const CircularProgressIndicator(),
              error: (_, _) =>
                  const Text('Não foi possível carregar os setores.'),
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
                          _sectorAssignments[sector.id] =
                              InviteSectorAssignment(
                                sectorId: sector.id,
                                sectorName: sector.name,
                              );
                        } else {
                          _sectorAssignments.remove(sector.id);
                        }
                      });
                    },
                    selectedColor: const Color(
                      0xFF0a2f7f,
                    ).withValues(alpha: 0.12),
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
            for (final assignment in _orderedAssignments) ...[
              const SizedBox(height: 20),
              _SectorAssignmentBlock(
                assignment: assignment,
                needsManager: _needsManager,
                needsTerritory: _needsTerritory,
                onPickManager: () => _pickManager(assignment),
                onClearManager: () => setState(() {
                  _sectorAssignments[assignment.sectorId] = assignment.copyWith(
                    clearManager: true,
                    territories: const [],
                  );
                }),
                onPickTerritories: () => _pickTerritories(assignment),
                onRemoveTerritory: (territoryId) {
                  setState(() {
                    _sectorAssignments[assignment.sectorId] = assignment
                        .copyWith(
                          territories: assignment.territories
                              .where((t) => t.id != territoryId)
                              .toList(),
                        );
                  });
                },
              ),
            ],
          ],
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
                  : Text(_isExisting ? 'Salvar alterações' : 'Enviar convite'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickManager(InviteSectorAssignment assignment) async {
    final managers = await ref.read(
      managersForSectorProvider(assignment.sectorId).future,
    );
    if (!mounted) return;
    final id = await ManagerPickerSheet.show(
      context,
      managers: managers,
      selectedId: assignment.managerId,
    );
    if (id == null || !mounted) return;
    ManagerOption? manager;
    for (final m in managers) {
      if (m.id == id) {
        manager = m;
        break;
      }
    }
    setState(() {
      _sectorAssignments[assignment.sectorId] = assignment.copyWith(
        managerId: id,
        managerName: manager?.name,
        // Manager change invalidates prior territory picks for this sector.
        territories: const [],
      );
    });
  }

  Future<void> _pickTerritories(InviteSectorAssignment assignment) async {
    final List<TerritoryOption>? picked;
    if (_needsManager) {
      final managerId = assignment.managerId;
      if (managerId == null) return;
      picked = await TerritoryPickerScreen.pickForManager(
        context,
        managerId: managerId,
        sectorId: assignment.sectorId,
        initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
      );
    } else {
      picked = await TerritoryPickerScreen.pickForSector(
        context,
        sectorId: assignment.sectorId,
        initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
      );
    }
    if (picked == null || !mounted) return;
    setState(() {
      _sectorAssignments[assignment.sectorId] = assignment.copyWith(
        territories: picked,
      );
    });
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 30),
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (picked != null && mounted) {
      setState(() => _birthDate = picked);
    }
  }

  Future<void> _submit() async {
    if (_selectedRole == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Selecione uma função.')));
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_birthDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informe a data de nascimento.')),
      );
      return;
    }

    if (_needsSectors && _sectorAssignments.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione ao menos um setor.')),
      );
      return;
    }

    if (_needsSectors) {
      for (final assignment in _orderedAssignments) {
        if (_needsManager && assignment.managerId == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Selecione o gerente para ${assignment.sectorName}.',
              ),
            ),
          );
          return;
        }
        if (_needsTerritory && assignment.territories.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Selecione ao menos um território para '
                '${assignment.sectorName}.',
              ),
            ),
          );
          return;
        }
      }
    }

    setState(() => _submitting = true);
    try {
      final role = _selectedRole!;

      // Server-side revalidation for REP scopes.
      if (role.name == UserRoleName.rep) {
        for (final assignment in _orderedAssignments) {
          final managerId = assignment.managerId;
          if (managerId == null) continue;
          final scope = await ref
              .read(usersRepositoryProvider)
              .getTerritoriesForManager(
                managerId,
                sectorId: assignment.sectorId,
              );
          final validIds = scope.territories.map((t) => t.id).toSet();
          final stillValid = assignment.territories.every(
            (t) => validIds.contains(t.id),
          );
          if (!stillValid) {
            if (mounted) {
              setState(() {
                _sectorAssignments[assignment.sectorId] = assignment.copyWith(
                  territories: const [],
                );
                _submitting = false;
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Territórios inválidos para ${assignment.sectorName}. '
                    'Selecione novamente.',
                  ),
                ),
              );
            }
            return;
          }
        }
      }

      final repo = ref.read(invitationsRepositoryProvider);
      final email = _emailController.text.trim();
      final firstName = _firstNameController.text.trim();
      final lastName = _lastNameController.text.trim();
      final phoneNumber = _phoneController.text.trim();
      final sectorAssignments = _needsSectors
          ? _orderedAssignments
          : const <InviteSectorAssignment>[];

      if (_isExisting) {
        await repo.updateInvitation(
          id: widget.invitationId!,
          email: email,
          firstName: firstName,
          lastName: lastName,
          birthDate: _birthDate!,
          phoneNumber: phoneNumber,
          roleId: role.id,
          sectorAssignments: sectorAssignments,
        );
        ref.invalidate(invitationDetailProvider(widget.invitationId!));
      } else {
        await repo.createInvitation(
          email: email,
          firstName: firstName,
          lastName: lastName,
          birthDate: _birthDate!,
          phoneNumber: phoneNumber,
          roleId: role.id,
          sectorAssignments: sectorAssignments,
        );
      }
      ref.invalidate(invitationsListProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isExisting
                  ? 'Convite atualizado com sucesso.'
                  : 'Convite enviado com sucesso.',
            ),
          ),
        );
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isExisting
                  ? 'Não foi possível salvar o convite.'
                  : 'Não foi possível enviar o convite.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _SectorAssignmentBlock extends StatelessWidget {
  const _SectorAssignmentBlock({
    required this.assignment,
    required this.needsManager,
    required this.needsTerritory,
    required this.onPickManager,
    required this.onClearManager,
    required this.onPickTerritories,
    required this.onRemoveTerritory,
  });

  final InviteSectorAssignment assignment;
  final bool needsManager;
  final bool needsTerritory;
  final VoidCallback onPickManager;
  final VoidCallback onClearManager;
  final VoidCallback onPickTerritories;
  final void Function(String territoryId) onRemoveTerritory;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFf7f8fb),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            assignment.sectorName,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          if (needsManager) ...[
            const SizedBox(height: 12),
            const _FieldLabel('Gerente responsável'),
            const SizedBox(height: 8),
            _PickerButton(
              label: assignment.managerName ?? 'Selecionar gerente',
              subtitle: assignment.managerId == null
                  ? 'Gerentes deste setor'
                  : null,
              icon: Icons.person_outline_rounded,
              onTap: onPickManager,
              onClear: assignment.managerId == null ? null : onClearManager,
            ),
          ],
          if (needsTerritory) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(child: _FieldLabel('Territórios')),
                TextButton(
                  onPressed: needsManager && assignment.managerId == null
                      ? null
                      : onPickTerritories,
                  child: Text(
                    assignment.territories.isEmpty ? 'Selecionar' : 'Editar',
                  ),
                ),
              ],
            ),
            if (needsManager && assignment.managerId == null)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text(
                  'Selecione um gerente primeiro.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF9ca3af)),
                ),
              )
            else if (assignment.territories.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text(
                  'Nenhum território selecionado.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF9ca3af)),
                ),
              )
            else
              SizedBox(
                height: 176,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  itemCount: assignment.territories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final territory = assignment.territories[index];
                    return Stack(
                      children: [
                        TerritoryMapCard(
                          assignment: TerritoryAssignment(
                            territoryId: territory.id,
                            territoryName: territory.name,
                            assignedAt: DateTime.now(),
                            sectorId: territory.sectorId,
                            sectorName: territory.sectorName,
                            centroid: territory.centroid,
                            boundary: territory.boundary,
                          ),
                          width: 220,
                          mapHeight: 120,
                          onTap: onPickTerritories,
                        ),
                        Positioned(
                          top: 28,
                          right: 4,
                          child: Material(
                            color: Colors.white,
                            shape: const CircleBorder(),
                            elevation: 1,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => onRemoveTerritory(territory.id),
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: Color(0xFF6b7280),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: Color(0xFF6b7280),
      ),
    );
  }
}

class _PickerButton extends StatelessWidget {
  const _PickerButton({
    required this.label,
    required this.icon,
    this.onTap,
    this.subtitle,
    this.onClear,
  });

  final String label;
  final String? subtitle;
  final IconData icon;
  final VoidCallback? onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFe5e7eb)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF0a2f7f)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (onClear != null)
                IconButton(
                  onPressed: onClear,
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: Color(0xFF9ca3af),
                  ),
                )
              else if (onTap != null)
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF9ca3af),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

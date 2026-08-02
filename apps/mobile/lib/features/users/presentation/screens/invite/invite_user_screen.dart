import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_target.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/territory_invite_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/screens/territory_editor_screen.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/invite_wizard_state.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_identity_step.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_patches_step.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_review_step.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_zones_step.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manager_empty_zones_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/rep_manager_zone_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/date_wheel_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Multi-step invite wizard: identity → territory (if needed) → review → send.
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
  final Map<String, InviteVerticalAssignment> _verticalAssignments = {};

  int _stepIndex = 0;
  bool _submitting = false;
  bool _loadingInvitation = false;
  Object? _loadError;
  bool _hydrated = false;

  bool get _isExisting => widget.invitationId != null;

  bool get _needsZone => _selectedRole?.name == UserRoleName.rep;

  bool get _needsTerritory =>
      _selectedRole?.name == UserRoleName.rep ||
      _selectedRole?.name == UserRoleName.manager;

  bool get _needsVerticals =>
      _selectedRole != null && _selectedRole!.name != UserRoleName.admin;

  List<InviteWizardStep> get _steps => buildInviteWizardSteps(_selectedRole);

  InviteWizardStep get _currentStep =>
      _steps[_stepIndex.clamp(0, _steps.length - 1)];

  List<InviteVerticalAssignment> get _orderedAssignments =>
      _verticalAssignments.values.toList(growable: false);

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
        _verticalAssignments
          ..clear()
          ..addEntries(
            invitation.verticalAssignments.map(
              (a) => MapEntry(a.verticalId, a),
            ),
          );
        _loadingInvitation = false;
        _loadError = null;
        _hydrated = false;
        _stepIndex = 0;
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

  String get _title => _isExisting ? 'Editar convite' : 'Novo convite';

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  /// Identity gate for Continuar on step 0. Uses [FormState] only while the
  /// identity Form is mounted — never call this expecting FormState on later
  /// steps (it is off-tree after AnimatedSwitcher swaps the body).
  bool _validateIdentityStep() {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return false;
    if (_birthDate == null) {
      _snack('Informe a data de nascimento.');
      return false;
    }
    if (_selectedRole == null) {
      _snack('Selecione uma função.');
      return false;
    }
    if (_needsVerticals && _verticalAssignments.isEmpty) {
      _snack('Selecione ao menos uma linha comercial.');
      return false;
    }
    return true;
  }

  bool _validateZones() {
    for (final assignment in _orderedAssignments) {
      if (_needsZone && assignment.managerZoneId == null) {
        _snack('Selecione a zona do gerente para ${assignment.verticalName}.');
        return false;
      }
      if (!_needsZone && _needsTerritory && assignment.territories.isEmpty) {
        _snack(
          'Selecione ao menos uma zona vazia para ${assignment.verticalName}.',
        );
        return false;
      }
    }
    return true;
  }

  bool _validatePatches() {
    for (final assignment in _orderedAssignments) {
      if (!assignment.hasTerritorySelection) {
        _snack(
          'Selecione ou desenhe ao menos uma área para '
          '${assignment.verticalName}.',
        );
        return false;
      }
    }
    return true;
  }

  int _indexOfKind(InviteWizardStepKind kind) =>
      _steps.indexWhere((s) => s.kind == kind);

  void _toggleSector(VerticalOption sector, bool selected) {
    setState(() {
      if (selected) {
        _verticalAssignments[sector.id] = InviteVerticalAssignment(
          verticalId: sector.id,
          verticalName: sector.name,
        );
      } else {
        _verticalAssignments.remove(sector.id);
      }
    });
  }

  void _goNext() {
    final kind = _currentStep.kind;
    if (kind == InviteWizardStepKind.identity && !_validateIdentityStep()) {
      return;
    }
    if (kind == InviteWizardStepKind.zones && !_validateZones()) {
      return;
    }
    if (kind == InviteWizardStepKind.patches && !_validatePatches()) {
      return;
    }
    if (kind == InviteWizardStepKind.review) {
      _submit();
      return;
    }

    final nextSteps = buildInviteWizardSteps(_selectedRole);
    final nextIndex = _stepIndex + 1;
    if (nextIndex >= nextSteps.length) return;
    setState(() => _stepIndex = nextIndex.clamp(0, nextSteps.length - 1));
  }

  void _goBack() {
    if (_stepIndex <= 0) {
      context.pop();
      return;
    }
    setState(() => _stepIndex -= 1);
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDateWheelPicker(
      context,
      initialDate: _birthDate ?? DateTime(now.year - 30),
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (picked != null && mounted) {
      setState(() => _birthDate = picked);
    }
  }

  Future<String?> _resolveManagerName(TerritoryOption zone) async {
    final fromOption = zone.assignedUserName?.trim();
    if (fromOption != null && fromOption.isNotEmpty) return fromOption;
    return ref.read(usersRepositoryProvider).getTerritoryAssigneeName(zone.id);
  }

  Future<void> _applyRepZone(
    InviteVerticalAssignment assignment,
    TerritoryOption zone,
  ) async {
    final managerName = await _resolveManagerName(zone);
    if (!mounted) return;
    setState(() {
      _verticalAssignments[assignment.verticalId] = assignment.copyWith(
        managerZoneId: zone.id,
        managerZoneName: zone.name,
        managerDisplayName: managerName,
        managers: managerName == null
            ? const []
            : [AssignmentManagerRef(id: zone.id, name: managerName)],
        territories: const [],
        clearNewPatch: true,
      );
    });
  }

  Future<void> _pickZone(InviteVerticalAssignment assignment) async {
    final zones = await ref
        .read(usersRepositoryProvider)
        .getTerritoryOptions(verticalId: assignment.verticalId);
    if (!mounted) return;

    final role = ref.read(currentUserRoleProvider);
    if (role == UserRoleName.manager && zones.length == 1) {
      await _applyRepZone(assignment, zones.first);
      return;
    }

    final zone = await RepManagerZonePickerScreen.pick(
      context,
      verticalId: assignment.verticalId,
      initiallySelectedId: assignment.managerZoneId,
    );
    if (zone == null || !mounted) return;
    await _applyRepZone(assignment, zone);
  }

  Future<void> _pickEmptyZones(InviteVerticalAssignment assignment) async {
    final picked = await ManagerEmptyZonesPickerScreen.pick(
      context,
      verticalId: assignment.verticalId,
      initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _verticalAssignments[assignment.verticalId] = assignment.copyWith(
        territories: picked,
        clearNewPatch: true,
      );
    });
  }

  Future<void> _pickTerritories(InviteVerticalAssignment assignment) async {
    final zoneId = assignment.managerZoneId;
    if (zoneId == null) return;
    final picked = await TerritoryPickerScreen.pickForZone(
      context,
      managerZoneId: zoneId,
      verticalId: assignment.verticalId,
      initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _verticalAssignments[assignment.verticalId] = assignment.copyWith(
        territories: picked,
        clearNewPatch: true,
      );
    });
  }

  Future<void> _drawNewPatch(InviteVerticalAssignment assignment) async {
    final zoneId = assignment.managerZoneId;
    if (zoneId == null) return;
    final verticalId = assignment.verticalId;

    final draft = await Navigator.of(context).push<TerritoryInviteDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryEditorScreen(
          target: TerritoryEditorTarget.creating(
            initialKind: TerritoryKind.repPatch,
            initialVerticalId: verticalId,
            initialVerticalName: assignment.verticalName,
            initialManagerTerritoryId: zoneId,
            initialManagerTerritoryName: assignment.managerZoneName,
            confirmAsDraftOnly: true,
          ),
        ),
      ),
    );
    if (draft == null || !mounted) return;

    setState(() {
      final current = _verticalAssignments[verticalId] ?? assignment;
      _verticalAssignments[verticalId] = current.copyWith(
        territories: const [],
        newPatch: InviteNewPatchDraft(
          name: draft.name,
          managerZoneId: draft.managerTerritoryId,
          boundary: Map<String, dynamic>.from(draft.boundary.toGeoJson()),
          centroid: draft.centroid,
          geometry: draft.boundary,
        ),
      );
    });
  }

  Future<void> _submit() async {
    // Identity / zones / patches already gated by Continuar. Do not call
    // FormState.validate here — the Form is not mounted on review.
    if (_selectedRole == null || _birthDate == null) {
      setState(() => _stepIndex = 0);
      return;
    }
    if (_needsZone && !_validateZones()) {
      final zonesIndex = _indexOfKind(InviteWizardStepKind.zones);
      if (zonesIndex >= 0) setState(() => _stepIndex = zonesIndex);
      return;
    }
    if (_needsZone && !_validatePatches()) {
      final patchesIndex = _indexOfKind(InviteWizardStepKind.patches);
      if (patchesIndex >= 0) setState(() => _stepIndex = patchesIndex);
      return;
    }
    if (!_needsZone && _needsTerritory && !_validateZones()) {
      final zonesIndex = _indexOfKind(InviteWizardStepKind.zones);
      if (zonesIndex >= 0) setState(() => _stepIndex = zonesIndex);
      return;
    }

    setState(() => _submitting = true);
    try {
      final role = _selectedRole!;

      if (role.name == UserRoleName.rep) {
        for (final assignment in _orderedAssignments) {
          if (assignment.newPatch != null) continue;
          final zoneId = assignment.managerZoneId;
          if (zoneId == null || assignment.territories.isEmpty) continue;
          final patches = await ref
              .read(usersRepositoryProvider)
              .getPatchesForZone(
                managerZoneId: zoneId,
                verticalId: assignment.verticalId,
              );
          final validIds = patches
              .where((t) => !t.isOccupied)
              .map((t) => t.id)
              .toSet();
          final stillValid = assignment.territories.every(
            (t) => validIds.contains(t.id),
          );
          if (!stillValid) {
            if (mounted) {
              setState(() {
                _verticalAssignments[assignment.verticalId] = assignment
                    .copyWith(territories: const []);
                _submitting = false;
                final patchesIndex = _indexOfKind(InviteWizardStepKind.patches);
                if (patchesIndex >= 0) _stepIndex = patchesIndex;
              });
              _snack(
                'Áreas inválidas para ${assignment.verticalName}. '
                'Selecione novamente (apenas áreas livres).',
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
      final verticalAssignments = _needsVerticals
          ? _orderedAssignments
          : const <InviteVerticalAssignment>[];

      if (_isExisting) {
        await repo.updateInvitation(
          id: widget.invitationId!,
          email: email,
          firstName: firstName,
          lastName: lastName,
          birthDate: _birthDate!,
          phoneNumber: phoneNumber,
          roleId: role.id,
          verticalAssignments: verticalAssignments,
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
          verticalAssignments: verticalAssignments,
        );
      }
      ref.invalidate(invitationsListProvider);
      if (mounted) {
        _snack(
          _isExisting
              ? 'Convite atualizado com sucesso.'
              : 'Convite enviado com sucesso.',
        );
        context.pop();
      }
    } catch (error) {
      if (!mounted) return;
      final detail = error is UsersApiException ? error.message : null;
      _snack(
        detail ??
            (_isExisting
                ? 'Não foi possível salvar o convite.'
                : 'Não foi possível enviar o convite.'),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rolesAsync = ref.watch(rolesProvider);
    final sectorsAsync = ref.watch(verticalOptionsProvider);
    final steps = _steps;
    // Keep index valid when role change shrinks step list.
    if (_stepIndex >= steps.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _stepIndex = steps.length - 1);
      });
    }
    final step = steps[_stepIndex.clamp(0, steps.length - 1)];
    final isReview = step.kind == InviteWizardStepKind.review;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _goBack,
                    icon: Icon(
                      _stepIndex == 0
                          ? Icons.close_rounded
                          : Icons.arrow_back_rounded,
                      color: AppColors.gray900,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      _title,
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
            Expanded(
              child: _loadingInvitation
                  ? const Center(child: CircularProgressIndicator())
                  : _loadError != null
                  ? const Center(
                      child: Text(
                        'Não foi possível carregar o convite.',
                        style: TextStyle(color: AppColors.gray500),
                      ),
                    )
                  : AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      switchInCurve: Curves.easeOut,
                      switchOutCurve: Curves.easeIn,
                      child: KeyedSubtree(
                        key: ValueKey(step.kind),
                        child: _buildStepBody(step, rolesAsync, sectorsAsync),
                      ),
                    ),
            ),
            if (!_loadingInvitation && _loadError == null)
              _InviteBottomBar(
                canGoBack: true,
                backLabel: _stepIndex == 0 ? 'Cancelar' : 'Voltar',
                nextLabel: isReview
                    ? (_isExisting ? 'Salvar alterações' : 'Enviar convite')
                    : 'Continuar',
                submitting: _submitting,
                onBack: _goBack,
                onNext: _submitting ? null : _goNext,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepBody(
    InviteWizardStep step,
    AsyncValue<List<UserRole>> rolesAsync,
    AsyncValue<List<VerticalOption>> sectorsAsync,
  ) {
    switch (step.kind) {
      case InviteWizardStepKind.identity:
        return rolesAsync.when(
          loading: () => InviteIdentityStep(
            title: step.title,
            description: step.subtitle,
            formKey: _formKey,
            firstNameController: _firstNameController,
            lastNameController: _lastNameController,
            emailController: _emailController,
            phoneController: _phoneController,
            birthDate: _birthDate,
            selectedRole: _selectedRole,
            roles: const [],
            rolesLoading: true,
            rolesError: false,
            onPickBirthDate: _pickBirthDate,
            onSelectRole: (_) {},
            sectors: sectorsAsync.valueOrNull ?? const [],
            sectorsLoading: sectorsAsync.isLoading,
            sectorsError: sectorsAsync.hasError,
            verticalAssignments: _verticalAssignments,
            onToggleSector: _toggleSector,
          ),
          error: (_, _) => InviteIdentityStep(
            title: step.title,
            description: step.subtitle,
            formKey: _formKey,
            firstNameController: _firstNameController,
            lastNameController: _lastNameController,
            emailController: _emailController,
            phoneController: _phoneController,
            birthDate: _birthDate,
            selectedRole: _selectedRole,
            roles: const [],
            rolesLoading: false,
            rolesError: true,
            onPickBirthDate: _pickBirthDate,
            onSelectRole: (_) {},
            sectors: sectorsAsync.valueOrNull ?? const [],
            sectorsLoading: sectorsAsync.isLoading,
            sectorsError: sectorsAsync.hasError,
            verticalAssignments: _verticalAssignments,
            onToggleSector: _toggleSector,
          ),
          data: (roles) {
            _hydrateRoleIfNeeded(roles);
            return InviteIdentityStep(
              title: step.title,
              description: step.subtitle,
              formKey: _formKey,
              firstNameController: _firstNameController,
              lastNameController: _lastNameController,
              emailController: _emailController,
              phoneController: _phoneController,
              birthDate: _birthDate,
              selectedRole: _selectedRole,
              roles: roles,
              rolesLoading: false,
              rolesError: false,
              onPickBirthDate: _pickBirthDate,
              onSelectRole: (role) => setState(() {
                _selectedRole = role;
                _verticalAssignments.clear();
              }),
              sectors: sectorsAsync.valueOrNull ?? const [],
              sectorsLoading: sectorsAsync.isLoading,
              sectorsError: sectorsAsync.hasError,
              verticalAssignments: _verticalAssignments,
              onToggleSector: _toggleSector,
            );
          },
        );
      case InviteWizardStepKind.zones:
        final role = _selectedRole;
        if (role == null) {
          return const Center(child: Text('Selecione uma função primeiro.'));
        }
        return InviteZonesStep(
          role: role,
          title: step.title,
          description: step.subtitle,
          verticalAssignments: _verticalAssignments,
          onPickZone: _pickZone,
          onClearZone: (assignment) {
            setState(() {
              _verticalAssignments[assignment.verticalId] = assignment.copyWith(
                clearZone: true,
                territories: const [],
              );
            });
          },
          onPickEmptyZones: _pickEmptyZones,
          onRemoveTerritory: (assignment, territoryId) {
            setState(() {
              _verticalAssignments[assignment.verticalId] = assignment.copyWith(
                territories: assignment.territories
                    .where((t) => t.id != territoryId)
                    .toList(),
              );
            });
          },
        );
      case InviteWizardStepKind.patches:
        if (_selectedRole == null) {
          return const Center(child: Text('Selecione uma função primeiro.'));
        }
        return InvitePatchesStep(
          title: step.title,
          description: step.subtitle,
          verticalAssignments: _verticalAssignments,
          onPickTerritories: _pickTerritories,
          onDrawNewPatch: _drawNewPatch,
          onClearNewPatch: (assignment) {
            setState(() {
              _verticalAssignments[assignment.verticalId] = assignment.copyWith(
                clearNewPatch: true,
              );
            });
          },
          onRemoveTerritory: (assignment, territoryId) {
            setState(() {
              _verticalAssignments[assignment.verticalId] = assignment.copyWith(
                territories: assignment.territories
                    .where((t) => t.id != territoryId)
                    .toList(),
              );
            });
          },
        );
      case InviteWizardStepKind.review:
        final role = _selectedRole!;
        return InviteReviewStep(
          title: step.title,
          description: step.subtitle,
          firstName: _firstNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
          email: _emailController.text.trim(),
          phone: _phoneController.text.trim(),
          birthDate: _birthDate!,
          role: role,
          assignments: _orderedAssignments,
        );
    }
  }
}

class _InviteBottomBar extends StatelessWidget {
  const _InviteBottomBar({
    required this.canGoBack,
    required this.backLabel,
    required this.nextLabel,
    required this.submitting,
    required this.onBack,
    required this.onNext,
  });

  final bool canGoBack;
  final String backLabel;
  final String nextLabel;
  final bool submitting;
  final VoidCallback onBack;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (canGoBack)
              Expanded(
                child: OutlinedButton(
                  onPressed: submitting ? null : onBack,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.gray700,
                    side: const BorderSide(color: AppColors.gray200),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    backLabel,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            if (canGoBack) const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: onNext,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyDeep,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        nextLabel,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

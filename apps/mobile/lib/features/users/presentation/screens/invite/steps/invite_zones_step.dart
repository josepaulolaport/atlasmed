import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_shared_widgets.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Wizard step: pick zones.
///
/// - REP: one parent manager zone per vertical
/// - MANAGER: one or more empty zones per vertical
class InviteZonesStep extends StatelessWidget {
  const InviteZonesStep({
    super.key,
    required this.role,
    required this.title,
    required this.description,
    required this.verticalAssignments,
    required this.onPickZone,
    required this.onClearZone,
    required this.onPickEmptyZones,
    required this.onRemoveTerritory,
  });

  final UserRole role;
  final String title;
  final String description;
  final Map<int, InviteVerticalAssignment> verticalAssignments;
  final void Function(InviteVerticalAssignment assignment) onPickZone;
  final void Function(InviteVerticalAssignment assignment) onClearZone;
  final void Function(InviteVerticalAssignment assignment) onPickEmptyZones;
  final void Function(InviteVerticalAssignment assignment, int territoryId)
  onRemoveTerritory;

  bool get _isRep => role.name == UserRoleName.rep;

  @override
  Widget build(BuildContext context) {
    final ordered = verticalAssignments.values.toList(growable: false);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        InviteStepHeader(title: title, description: description),
        for (var i = 0; i < ordered.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          if (_isRep)
            _RepZoneCard(
              assignment: ordered[i],
              onPickZone: () => onPickZone(ordered[i]),
              onClearZone: () => onClearZone(ordered[i]),
            )
          else
            _ManagerZonesCard(
              assignment: ordered[i],
              onPickEmptyZones: () => onPickEmptyZones(ordered[i]),
              onRemoveTerritory: (id) => onRemoveTerritory(ordered[i], id),
            ),
        ],
      ],
    );
  }
}

/// Fixed-height zone picker — empty and filled share the same footprint.
class _RepZoneCard extends StatelessWidget {
  const _RepZoneCard({
    required this.assignment,
    required this.onPickZone,
    required this.onClearZone,
  });

  final InviteVerticalAssignment assignment;
  final VoidCallback onPickZone;
  final VoidCallback onClearZone;

  static const _tileHeight = 96.0;

  @override
  Widget build(BuildContext context) {
    final selected = assignment.managerZoneId != null;
    final zoneName = assignment.managerZoneName;
    final managerName = assignment.managerName;

    return InviteStepCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            assignment.verticalName,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: _tileHeight,
            child: Material(
              color: selected
                  ? AppColors.navyDeep.withValues(alpha: 0.04)
                  : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: selected
                      ? AppColors.navyDeep.withValues(alpha: 0.25)
                      : AppColors.gray200,
                ),
              ),
              child: InkWell(
                onTap: onPickZone,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Icon(
                          Icons.map_outlined,
                          size: 20,
                          color: AppColors.navyDeep,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: selected
                            ? Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Text(
                                      zoneName ?? '',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        height: 1.25,
                                        color: AppColors.gray900,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    managerName == null || managerName.isEmpty
                                        ? 'Gerente não identificado'
                                        : managerName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.navyDeep,
                                    ),
                                  ),
                                ],
                              )
                            : const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Selecionar zona',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.gray900,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Nome da zona e do gerente',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      color: AppColors.gray400,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                      if (selected)
                        IconButton(
                          onPressed: onClearZone,
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 36,
                            minHeight: 36,
                          ),
                          icon: const Icon(
                            Icons.close_rounded,
                            size: 18,
                            color: AppColors.gray400,
                          ),
                        )
                      else
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.gray400,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ManagerZonesCard extends StatelessWidget {
  const _ManagerZonesCard({
    required this.assignment,
    required this.onPickEmptyZones,
    required this.onRemoveTerritory,
  });

  final InviteVerticalAssignment assignment;
  final VoidCallback onPickEmptyZones;
  final void Function(int territoryId) onRemoveTerritory;

  static const _previewHeight = 176.0;

  @override
  Widget build(BuildContext context) {
    final selected = assignment.territories;

    return InviteStepCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            assignment.verticalName,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onPickEmptyZones,
              icon: const Icon(Icons.map_outlined, size: 18),
              label: Text(
                selected.isEmpty ? 'Selecionar zonas vazias' : 'Editar zonas',
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.navyDeep,
                side: const BorderSide(color: AppColors.gray200),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: _previewHeight,
            child: selected.isEmpty
                ? Container(
                    width: double.infinity,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceTertiary,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.gray200),
                    ),
                    child: const Text(
                      'Nenhuma zona selecionada',
                      style: TextStyle(fontSize: 13, color: AppColors.gray400),
                    ),
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: selected.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final territory = selected[index];
                      return Stack(
                        children: [
                          TerritoryMapCard(
                            assignment: TerritoryAssignment(
                              territoryId: territory.id,
                              territoryName: territory.name,
                              assignedAt: DateTime.now(),
                              verticalId: territory.verticalId,
                              verticalName: territory.verticalName,
                              centroid: territory.centroid,
                              boundary: territory.boundary,
                            ),
                            width: 220,
                            mapHeight: 120,
                            onTap: onPickEmptyZones,
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
                                    color: AppColors.gray500,
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
      ),
    );
  }
}

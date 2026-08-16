import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_shared_widgets.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// REP wizard step: free patches / draw under the locked manager zone.
class InvitePatchesStep extends StatelessWidget {
  const InvitePatchesStep({
    super.key,
    required this.title,
    required this.description,
    required this.verticalAssignments,
    required this.onPickTerritories,
    required this.onDrawNewPatch,
    required this.onClearNewPatch,
    required this.onRemoveTerritory,
  });

  final String title;
  final String description;
  final Map<int, InviteVerticalAssignment> verticalAssignments;
  final void Function(InviteVerticalAssignment assignment) onPickTerritories;
  final void Function(InviteVerticalAssignment assignment) onDrawNewPatch;
  final void Function(InviteVerticalAssignment assignment) onClearNewPatch;
  final void Function(InviteVerticalAssignment assignment, int territoryId)
  onRemoveTerritory;

  @override
  Widget build(BuildContext context) {
    final ordered = verticalAssignments.values.toList(growable: false);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        InviteStepHeader(title: title, description: description),
        for (var i = 0; i < ordered.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          _PatchBlock(
            assignment: ordered[i],
            onPickTerritories: () => onPickTerritories(ordered[i]),
            onDrawNewPatch: () => onDrawNewPatch(ordered[i]),
            onClearNewPatch: () => onClearNewPatch(ordered[i]),
            onRemoveTerritory: (id) => onRemoveTerritory(ordered[i], id),
          ),
        ],
      ],
    );
  }
}

class _PatchBlock extends StatelessWidget {
  const _PatchBlock({
    required this.assignment,
    required this.onPickTerritories,
    required this.onDrawNewPatch,
    required this.onClearNewPatch,
    required this.onRemoveTerritory,
  });

  final InviteVerticalAssignment assignment;
  final VoidCallback onPickTerritories;
  final VoidCallback onDrawNewPatch;
  final VoidCallback onClearNewPatch;
  final void Function(int territoryId) onRemoveTerritory;

  static const _previewHeight = 176.0;

  @override
  Widget build(BuildContext context) {
    final draft = assignment.newPatch;
    final hasSelection = draft != null || assignment.territories.isNotEmpty;

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
          if (assignment.managerZoneId == null) ...[
            // Both buttons below go dead without a zone, and nothing said so —
            // the step just sat there with two greyed controls and an empty
            // placeholder.
            const SizedBox(height: 8),
            const Text(
              'Escolha a zona do gerente no passo anterior para liberar as '
              'áreas desta linha.',
              style: TextStyle(fontSize: 12.5, color: AppColors.amberDark),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: assignment.managerZoneId == null
                      ? null
                      : onPickTerritories,
                  icon: const Icon(Icons.layers_outlined, size: 18),
                  label: Text(
                    assignment.territories.isEmpty && draft == null
                        ? 'Escolher área'
                        : 'Trocar área',
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
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: assignment.managerZoneId == null
                      ? null
                      : onDrawNewPatch,
                  icon: const Icon(Icons.draw_outlined, size: 18),
                  label: Text(draft == null ? 'Desenhar' : 'Redesenhar'),
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
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: _previewHeight,
            child: !hasSelection
                ? Container(
                    width: double.infinity,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceTertiary,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.gray200),
                    ),
                    child: const Text(
                      'Área escolhida aparece aqui',
                      style: TextStyle(fontSize: 13, color: AppColors.gray400),
                    ),
                  )
                : draft != null
                ? Align(
                    alignment: Alignment.centerLeft,
                    child: Stack(
                      children: [
                        TerritoryMapCard(
                          assignment: TerritoryAssignment(
                            territoryId: -assignment.verticalId,
                            territoryName:
                                'Nova área (rascunho): ${draft.name}',
                            assignedAt: DateTime.now(),
                            verticalId: assignment.verticalId,
                            verticalName: assignment.verticalName,
                            centroid: draft.centroid,
                            boundary: draft.geometry,
                          ),
                          width: 220,
                          mapHeight: 120,
                          onTap: onDrawNewPatch,
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
                              onTap: onClearNewPatch,
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
                    ),
                  )
                : ListView.separated(
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
                              verticalId: territory.verticalId,
                              verticalName: territory.verticalName,
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

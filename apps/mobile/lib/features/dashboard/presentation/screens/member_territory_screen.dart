import 'package:atlasmed_mobile_app/features/dashboard/data/models/member_territory_map.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/member_territory_view.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_target.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A member's territory, full screen (spec 0015 R9/R10).
///
/// The map itself is the same widget the profile previews, so opening it
/// enlarges what you were already looking at rather than showing a second
/// drawing of it.
///
/// Editing is not reimplemented here. Every polygon change goes through the
/// Territórios editor, which already carries snapping, the territory-type
/// rules, the boundary-impact sheet and the atomic save (spec 0009 R1). A
/// second editor would be a second set of those rules, and the one that drifted
/// would be the one nobody was testing.
class MemberTerritoryScreen extends ConsumerWidget {
  const MemberTerritoryScreen({
    super.key,
    required this.userId,
    this.memberName,
    this.viaManagerId,
    this.isRep = true,
  });

  final int userId;
  final String? memberName;
  final int? viaManagerId;

  /// Decides what "new" means here: a rep gets a patch, and only an admin ever
  /// draws a zone (spec 0009 §3.3).
  final bool isRep;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    if (verticalId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final args = MemberTerritoryArgs(
      verticalId: verticalId,
      userId: userId,
      viaManagerId: viaManagerId,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(memberName ?? 'Território')),
      body: RepositoryBuilder(
        repository: ref.watch(memberTerritoryProvider(args)),
        builder: (context, map, repo) {
          if (map == null) {
            return const Center(child: CircularProgressIndicator());
          }
          return Column(
            children: [
              Expanded(
                child: MemberTerritoryView(
                  map: map,
                  height: double.infinity,
                  interactive: true,
                ),
              ),
              _Legend(map: map, isRep: isRep),
              _Actions(
                map: map,
                isRep: isRep,
                verticalId: verticalId,
                // Spec 0015 R13: a boundary change moves clinics between
                // people, so it is not only the map that went stale.
                onChanged: () => invalidateAssignmentDerivedData(ref),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// What the colours mean. A map with three shades and no key is a decoration.
class _Legend extends StatelessWidget {
  const _Legend({required this.map, required this.isRep});

  final MemberTerritoryMap map;
  final bool isRep;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Wrap(
        spacing: 14,
        runSpacing: 6,
        children: [
          _Key(
            colour: const Color(0xFF2563EB),
            label: isRep ? 'Área desta pessoa' : 'Zonas deste gestor',
          ),
          if (map.context.isNotEmpty)
            const _Key(colour: Color(0xFF0F172A), label: 'Zona do gestor'),
          if (map.taken.isNotEmpty)
            const _Key(colour: Color(0xFF6B7280), label: 'Já ocupado'),
        ],
      ),
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.colour, required this.label});

  final Color colour;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: colour.withValues(alpha: 0.35),
            border: Border.all(color: colour, width: 1.4),
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
        ),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.map,
    required this.isRep,
    required this.verticalId,
    required this.onChanged,
  });

  final MemberTerritoryMap map;
  final bool isRep;
  final int verticalId;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    if (!map.canEdit) {
      // OPS, or a manager looking at a zone. Saying why beats a screen whose
      // buttons are simply absent.
      return Container(
        width: double.infinity,
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
        child: const Text(
          'Somente leitura. A geometria das zonas é editada por um administrador.',
          style: TextStyle(fontSize: 12, color: AppColors.gray500),
        ),
      );
    }

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              icon: const Icon(Icons.edit_location_alt_outlined, size: 18),
              label: Text(map.subject.length == 1 ? 'Editar área' : 'Editar'),
              onPressed: map.subject.isEmpty ? null : () => _edit(context),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              icon: const Icon(Icons.add_location_alt_outlined, size: 18),
              label: const Text('Nova área'),
              onPressed: () => _create(context),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _edit(BuildContext context) async {
    // One area edits directly; several have to be chosen between, since the
    // editor works on one territory at a time.
    final target = map.subject.length == 1
        ? map.subject.first
        : await showModalBottomSheet<TerritoryMapFeature>(
            context: context,
            builder: (sheetContext) => SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Qual área editar?',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  for (final feature in map.subject)
                    ListTile(
                      title: Text(feature.name),
                      onTap: () => Navigator.of(sheetContext).pop(feature),
                    ),
                ],
              ),
            ),
          );

    if (target == null || !context.mounted) return;
    await TerritoryEditRoute(id: target.id).push(context);
    onChanged();
  }

  Future<void> _create(BuildContext context) async {
    // I4: a patch sits inside exactly one zone. When the reader's ground is
    // several zones, which one it belongs to is a real question with no safe
    // default, so it is asked rather than guessed.
    int? zoneId;
    if (isRep) {
      if (map.context.length == 1) {
        zoneId = map.context.first.id;
      } else if (map.context.length > 1) {
        final chosen = await showModalBottomSheet<TerritoryMapFeature>(
          context: context,
          builder: (sheetContext) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Em qual zona?',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                for (final feature in map.context)
                  ListTile(
                    title: Text(feature.name),
                    onTap: () => Navigator.of(sheetContext).pop(feature),
                  ),
              ],
            ),
          ),
        );
        if (chosen == null) return;
        zoneId = chosen.id;
      }
    }

    if (!context.mounted) return;
    await TerritoryCreateRoute(
      $extra: TerritoryEditorTarget.creating(
        initialKind: isRep ? TerritoryKind.repPatch : TerritoryKind.managerZone,
        initialVerticalId: verticalId,
        initialManagerTerritoryId: zoneId,
      ),
    ).push(context);
    onChanged();
  }
}

import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/user_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Bottom sheet with a summary of the tapped territory.
class TerritoryDetailSheet extends ConsumerWidget {
  final Territory territory;

  const TerritoryDetailSheet({super.key, required this.territory});

  static Future<void> show(BuildContext context, Territory territory) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => TerritoryDetailSheet(territory: territory),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isManagerZone = territory.kind == TerritoryKind.managerZone;
    final kindColor = isManagerZone ? AppColors.blue600 : AppColors.green;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.gray200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: kindColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                territory.territoryType.name,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: kindColor,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              territory.name,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 18),
            _DetailRow(label: 'Código', value: territory.code),
            if (territory.assignedUserId != null)
              _AssignedUserRow(
                label: isManagerZone
                    ? 'Gerente responsável'
                    : 'Representante responsável',
                userId: territory.assignedUserId!,
              )
            else
              _DetailRow(
                label: isManagerZone
                    ? 'Gerente responsável'
                    : 'Representante responsável',
                value: 'Não atribuído',
              ),
            _DetailRow(label: 'Clínicas', value: '${territory.clinicCount}'),
            _DetailRow(
              label: 'Usuários atribuídos',
              value: '${territory.assignedUserCount}',
            ),
            if (isManagerZone)
              _DetailRow(
                label: 'Áreas de representante',
                value: '${territory.repPatchCount ?? 0}',
              )
            else if (territory.managerTerritoryId != null)
              _ManagerZoneRow(
                managerTerritoryId: territory.managerTerritoryId!,
              ),
          ],
        ),
      ),
    );
  }
}

class _AssignedUserRow extends ConsumerWidget {
  final String label;
  final String userId;

  const _AssignedUserRow({required this.label, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userByIdProvider(userId));
    final value = userAsync.when(
      data: (user) => user?.name ?? '—',
      loading: () => '…',
      error: (_, _) => '—',
    );
    return _DetailRow(label: label, value: value);
  }
}

class _ManagerZoneRow extends ConsumerWidget {
  final String managerTerritoryId;

  const _ManagerZoneRow({required this.managerTerritoryId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentAsync = ref.watch(territoryByIdProvider(managerTerritoryId));
    final value = parentAsync.when(
      data: (parent) => parent?.name ?? '—',
      loading: () => '…',
      error: (_, _) => '—',
    );
    return _DetailRow(label: 'Zona de gerente', value: value);
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
        ],
      ),
    );
  }
}

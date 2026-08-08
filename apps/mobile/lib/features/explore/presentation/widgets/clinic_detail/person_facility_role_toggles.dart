import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Catalog-driven role switches. Parent owns [selected] and mutates via [onChanged].
class PersonFacilityRoleToggles extends StatelessWidget {
  const PersonFacilityRoleToggles({
    super.key,
    required this.catalog,
    required this.selected,
    required this.onChanged,
    this.enabled = true,
  });

  final List<PersonFacilityRoleCatalogEntry> catalog;
  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (catalog.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Text(
          'Nenhum papel disponível',
          style: TextStyle(fontSize: 13, color: AppColors.gray500),
        ),
      );
    }

    return Column(
      children: [
        for (final role in catalog)
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: Text(
              role.name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            value: selected.contains(role.id),
            activeThumbColor: AppColors.navyBright,
            onChanged: !enabled
                ? null
                : (next) {
                    final nextSet = Set<int>.from(selected);
                    if (next) {
                      nextSet.add(role.id);
                    } else {
                      nextSet.remove(role.id);
                    }
                    onChanged(nextSet);
                  },
          ),
      ],
    );
  }
}

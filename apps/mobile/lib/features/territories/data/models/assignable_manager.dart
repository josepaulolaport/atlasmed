import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';

/// A candidate for "which manager does this rep patch report to" —
/// pairs the manager themself with the id of the manager-zone territory
/// picking them resolves to (`Territory.managerTerritoryId`). See
/// `TerritoryRepository.getAssignableManagers`.
class AssignableManager {
  final AppUser manager;
  final String zoneTerritoryId;
  final String zoneName;

  const AssignableManager({
    required this.manager,
    required this.zoneTerritoryId,
    required this.zoneName,
  });
}

import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

class TerritoryEditorTarget {
  final String? territoryId;
  final TerritoryKind? initialKind;
  final String? initialVerticalId;
  final String? initialVerticalName;

  /// When creating a rep patch from invite (or similar), preselect this zone.
  final String? initialManagerTerritoryId;
  final String? initialManagerTerritoryName;

  /// Invite path: validate geometry locally and pop [TerritoryInviteDraft]
  /// without calling createTerritory.
  final bool confirmAsDraftOnly;

  /// Invite draft: vertical + manager zone already chosen — metadata UI
  /// only asks for the patch name.
  bool get inviteContextLocked =>
      confirmAsDraftOnly &&
      initialVerticalId != null &&
      initialManagerTerritoryId != null;

  const TerritoryEditorTarget.existing(this.territoryId)
      : initialKind = null,
        initialVerticalId = null,
        initialVerticalName = null,
        initialManagerTerritoryId = null,
        initialManagerTerritoryName = null,
        confirmAsDraftOnly = false;

  const TerritoryEditorTarget.creating({
    required this.initialKind,
    this.initialVerticalId,
    this.initialVerticalName,
    this.initialManagerTerritoryId,
    this.initialManagerTerritoryName,
    this.confirmAsDraftOnly = false,
  }) : territoryId = null;

  bool get isCreating => territoryId == null;

  @override
  bool operator ==(Object other) =>
      other is TerritoryEditorTarget &&
      other.territoryId == territoryId &&
      other.initialKind == initialKind &&
      other.initialVerticalId == initialVerticalId &&
      other.initialVerticalName == initialVerticalName &&
      other.initialManagerTerritoryId == initialManagerTerritoryId &&
      other.initialManagerTerritoryName == initialManagerTerritoryName &&
      other.confirmAsDraftOnly == confirmAsDraftOnly;

  @override
  int get hashCode => Object.hash(
        territoryId,
        initialKind,
        initialVerticalId,
        initialVerticalName,
        initialManagerTerritoryId,
        initialManagerTerritoryName,
        confirmAsDraftOnly,
      );
}

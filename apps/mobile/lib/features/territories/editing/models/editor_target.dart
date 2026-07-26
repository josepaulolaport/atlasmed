import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

class TerritoryEditorTarget {
  final String? territoryId;
  final TerritoryKind? initialKind;
  final String? initialVerticalId;

  const TerritoryEditorTarget.existing(this.territoryId)
    : initialKind = null,
      initialVerticalId = null;

  const TerritoryEditorTarget.creating({
    required this.initialKind,
    this.initialVerticalId,
  }) : territoryId = null;

  bool get isCreating => territoryId == null;

  @override
  bool operator ==(Object other) =>
      other is TerritoryEditorTarget &&
      other.territoryId == territoryId &&
      other.initialKind == initialKind &&
      other.initialVerticalId == initialVerticalId;

  @override
  int get hashCode => Object.hash(territoryId, initialKind, initialVerticalId);
}

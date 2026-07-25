import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

class TerritoryEditorTarget {
  final String? territoryId;
  final TerritoryKind? initialKind;

  const TerritoryEditorTarget.existing(this.territoryId) : initialKind = null;

  const TerritoryEditorTarget.creating({required this.initialKind})
    : territoryId = null;

  bool get isCreating => territoryId == null;

  @override
  bool operator ==(Object other) =>
      other is TerritoryEditorTarget &&
      other.territoryId == territoryId &&
      other.initialKind == initialKind;

  @override
  int get hashCode => Object.hash(territoryId, initialKind);
}

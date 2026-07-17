import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

/// Identifies what the territory geometry editor is working on — either an
/// existing territory (looked up by id) or a brand-new one still being
/// drawn from scratch. This is the `territoryEditorControllerProvider`
/// family key, so it needs value equality (see `==`/`hashCode` below).
class TerritoryEditorTarget {
  /// Set only for [existing] targets.
  final String? territoryId;

  /// Set only for [creating] targets — the kind/sector the metadata form
  /// starts pre-filled with.
  final TerritoryKind? initialKind;
  final String? initialSectorId;

  const TerritoryEditorTarget.existing(this.territoryId)
    : initialKind = null,
      initialSectorId = null;

  const TerritoryEditorTarget.creating({
    required this.initialKind,
    this.initialSectorId,
  }) : territoryId = null;

  bool get isCreating => territoryId == null;

  @override
  bool operator ==(Object other) =>
      other is TerritoryEditorTarget &&
      other.territoryId == territoryId &&
      other.initialKind == initialKind &&
      other.initialSectorId == initialSectorId;

  @override
  int get hashCode => Object.hash(territoryId, initialKind, initialSectorId);
}

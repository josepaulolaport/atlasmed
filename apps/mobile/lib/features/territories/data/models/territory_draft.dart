import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

/// Sentinel used by [TerritoryDraft.copyWith] so nullable fields can be
/// explicitly reset to `null` (vs. "leave unchanged", the default).
class _Unset {
  const _Unset();
}

const _unset = _Unset();

/// The metadata a new territory needs beyond its geometry — collected by
/// [TerritoryMetadataForm] before/while drawing, and handed to
/// [TerritoryRepository.createTerritory] once the shape is finished.
class TerritoryDraft {
  final String name;
  final TerritoryKind kind;
  final String verticalId;

  /// Required when [kind] is [TerritoryKind.repPatch] — the manager zone
  /// this patch belongs to. Always `null` for a manager zone itself.
  final String? managerTerritoryId;

  const TerritoryDraft({
    required this.name,
    required this.kind,
    required this.verticalId,
    this.managerTerritoryId,
  });

  TerritoryDraft copyWith({
    String? name,
    TerritoryKind? kind,
    String? verticalId,
    Object? managerTerritoryId = _unset,
  }) {
    return TerritoryDraft(
      name: name ?? this.name,
      kind: kind ?? this.kind,
      verticalId: verticalId ?? this.verticalId,
      managerTerritoryId: identical(managerTerritoryId, _unset)
          ? this.managerTerritoryId
          : managerTerritoryId as String?,
    );
  }
}

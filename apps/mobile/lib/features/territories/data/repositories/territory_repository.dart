import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';

/// Port for the territories data source.
///
/// Method signatures mirror the real endpoints (`GET /sectors`,
/// `GET /territories?type=&sectorId=`) so a future HTTP-backed
/// implementation is a drop-in replacement for [MockTerritoryRepository].
abstract interface class TerritoryRepository {
  Future<List<Sector>> getSectors();

  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    required String sectorId,
  });

  /// Used by the detail sheet to resolve a rep patch's parent manager zone
  /// name (`Territory.managerTerritoryId`).
  Future<Territory?> getTerritoryById(String id);

  /// Persists an edited boundary from the territory geometry editor. On the
  /// real API this will be `PUT /territories/:id/boundary`; the mock
  /// implementation mutates its in-memory copy instead.
  Future<void> updateTerritoryGeometry(String id, TerritoryGeometry geometry);

  /// Creates a brand-new territory from the metadata form's [draft] plus
  /// the geometry drawn in the editor. The real API would assign
  /// `id`/`slug`/`code`; the mock implementation does the same locally.
  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  );

  /// Deletes a territory. On the real API this will be
  /// `DELETE /territories/:id`; the mock implementation also unassigns
  /// (rather than cascade-deleting) any rep patch left pointing at a
  /// deleted manager zone.
  Future<void> deleteTerritory(String id);

  /// Sets (or, with `null`, clears) the territory's single assignee. On the
  /// real API this maps to the `user_territory_assignments` join table
  /// (`POST`/`DELETE /territories/:id/assignments`); the mock model keeps
  /// it as a plain `assignedUserId` field.
  Future<void> assignUser(String territoryId, String? userId);

  /// Updates metadata only — never kind, sector-defining geometry, or the
  /// boundary itself. Mirrors the real `PATCH /territories/:id`, which
  /// only ever touches `name`, `parentId` (our [managerTerritoryId]), and
  /// `isActive`; `sectorId` is kept here too as a mock-only convenience.
  Future<void> updateTerritoryInfo(
    String territoryId, {
    required String name,
    required String sectorId,
    required bool isActive,
    String? managerTerritoryId,
  });

  /// Managers currently assigned to an active manager-zone territory in
  /// [sectorId] — the candidate list for "which manager does this rep
  /// patch report to". Picking one resolves to that manager's zone id
  /// (`Territory.managerTerritoryId`), not to the manager's own id.
  Future<List<AssignableManager>> getAssignableManagers(String sectorId);
}

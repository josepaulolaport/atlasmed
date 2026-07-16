import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/mock_territory_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final territoryRepositoryProvider = Provider<TerritoryRepository>((ref) {
  return MockTerritoryRepository();
});

final sectorsProvider = FutureProvider<List<Sector>>((ref) {
  return ref.watch(territoryRepositoryProvider).getSectors();
});

/// Rep patch vs manager zone toggle. Defaults to manager zones.
final selectedTerritoryKindProvider = StateProvider<TerritoryKind>((ref) {
  return TerritoryKind.managerZone;
});

/// User's explicit sector choice, if any. `null` means "use the first
/// available sector" — see [effectiveSectorIdProvider].
final selectedSectorIdProvider = StateProvider<String?>((ref) => null);

/// Resolves the sector actually in effect: the user's selection when it's
/// still valid, otherwise the first sector returned by the repository.
final effectiveSectorIdProvider = FutureProvider<String?>((ref) async {
  final sectors = await ref.watch(sectorsProvider.future);
  if (sectors.isEmpty) return null;

  final selected = ref.watch(selectedSectorIdProvider);
  if (selected != null && sectors.any((sector) => sector.id == selected)) {
    return selected;
  }
  return sectors.first.id;
});

/// Territories matching the current kind + sector filters.
final territoriesProvider = FutureProvider<List<Territory>>((ref) async {
  final sectorId = await ref.watch(effectiveSectorIdProvider.future);
  if (sectorId == null) return const [];

  final repository = ref.watch(territoryRepositoryProvider);
  final kind = ref.watch(selectedTerritoryKindProvider);
  return repository.getTerritories(
    territoryTypeSlug: kind.slug,
    sectorId: sectorId,
  );
});

/// Territory tapped on the map, if any. Drives the detail bottom sheet and
/// the highlighted outline.
final selectedTerritoryIdProvider = StateProvider<String?>((ref) => null);

/// Looks up a single territory by id — used to resolve a rep patch's
/// parent manager zone name in the detail sheet.
final territoryByIdProvider = FutureProvider.family<Territory?, String>((
  ref,
  id,
) {
  return ref.watch(territoryRepositoryProvider).getTerritoryById(id);
});

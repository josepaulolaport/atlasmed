import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/http_territory_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final territoryRepositoryProvider = Provider<TerritoryRepository>((ref) {
  return HttpTerritoryRepository();
});

final isAdminProvider = Provider<bool>((ref) {
  final user = ref.watch(currentUserProvider).valueOrNull;
  return user?.role.name == UserRoleName.admin;
});

/// Active business verticals for invite/profile pickers.
final businessVerticalsProvider = FutureProvider<List<BusinessVertical>>((ref) {
  return ref.watch(territoryRepositoryProvider).getVerticals();
});

final selectedTerritoryKindProvider = StateProvider<TerritoryKind>((ref) {
  return TerritoryKind.managerZone;
});

final selectedTerritoryVerticalIdProvider = StateProvider<int?>((ref) {
  return null;
});

/// Spec 0006: when viewing patches, show only one rep's shapes (not all overlaps).
final selectedGeographyRepUserIdProvider = StateProvider<int?>((ref) => null);

final territoriesProvider = FutureProvider<List<Territory>>((ref) async {
  final repository = ref.watch(territoryRepositoryProvider);
  final kind = ref.watch(selectedTerritoryKindProvider);
  final verticalId = ref.watch(selectedTerritoryVerticalIdProvider);
  return repository.getTerritories(
    territoryTypeSlug: kind.slug,
    verticalId: verticalId,
  );
});

/// Manager zones drawn under patches on the geography map.
final managerZonesUnderlayProvider = FutureProvider<List<Territory>>((
  ref,
) async {
  final kind = ref.watch(selectedTerritoryKindProvider);
  if (kind != TerritoryKind.repPatch) return const [];
  final repository = ref.watch(territoryRepositoryProvider);
  final verticalId = ref.watch(selectedTerritoryVerticalIdProvider);
  return repository.getTerritories(
    territoryTypeSlug: TerritoryKind.managerZone.slug,
    verticalId: verticalId,
  );
});

final selectedTerritoryIdProvider = StateProvider<int?>((ref) => null);

final territoryByIdProvider = FutureProvider.family<Territory?, int>((ref, id) {
  return ref.watch(territoryRepositoryProvider).getTerritoryById(id);
});

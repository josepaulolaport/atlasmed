import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

Set<String> sharedNearbyVerticalIds({
  required Iterable<String> clinicVerticalIds,
  required Iterable<String> userVerticalIds,
}) {
  final user = userVerticalIds.toSet();
  if (user.isEmpty) return clinicVerticalIds.toSet();
  return clinicVerticalIds.where(user.contains).toSet();
}

/// Resolves the vertical used by the nearby facilities query.
String? resolveNearbyVerticalId({
  required Set<String> sharedVerticalIds,
  required String? selectedVerticalId,
  String? fallbackEffectiveId,
}) {
  if (sharedVerticalIds.isEmpty) return fallbackEffectiveId;
  if (sharedVerticalIds.length == 1) return sharedVerticalIds.single;
  if (selectedVerticalId != null &&
      sharedVerticalIds.contains(selectedVerticalId)) {
    return selectedVerticalId;
  }
  return null;
}

/// Filters the "Todas" result to verticals shared by user and clinic.
List<NearbyEstablishment> filterNearbyBySharedVerticals(
  List<NearbyEstablishment> items,
  Set<String> sharedVerticalIds,
) {
  if (sharedVerticalIds.isEmpty) return items;
  return items
      .where(
        (item) => item.verticals.any(
          (vertical) => sharedVerticalIds.contains(vertical.id),
        ),
      )
      .toList(growable: false);
}

List<NearbyEstablishment> applyNearbyVerticalScope({
  required List<NearbyEstablishment> items,
  required Set<String> sharedVerticalIds,
  required String? queryVerticalId,
}) {
  if (sharedVerticalIds.length > 1 && queryVerticalId == null) {
    return filterNearbyBySharedVerticals(items, sharedVerticalIds);
  }
  return items;
}

/// Query key for establishment-centered proximity search.
class NearbyFacilitiesQuery {
  const NearbyFacilitiesQuery({
    required this.facilityId,
    required this.latitude,
    required this.longitude,
    required this.radiusKm,
    this.verticalId,
  });

  final String facilityId;
  final double latitude;
  final double longitude;
  final double radiusKm;
  final String? verticalId;

  @override
  bool operator ==(Object other) {
    return other is NearbyFacilitiesQuery &&
        other.facilityId == facilityId &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm &&
        other.verticalId == verticalId;
  }

  @override
  int get hashCode =>
      Object.hash(facilityId, latitude, longitude, radiusKm, verticalId);
}

/// Inline preview: nearby within [establishmentNearbyPreviewRadiusKm].
///
/// Prefers shell/loaded lat·lng so this does not wait on a second detail GET.
final facilityNearbyPreviewProvider =
    FutureProvider.family<List<NearbyEstablishment>, String>((
      ref,
      facilityId,
    ) async {
      if (isMockNearbyFacilityId(facilityId)) {
        return const [];
      }

      double? lat;
      double? lng;
      Iterable<String> clinicVerticalIds = const [];

      final display = ref.watch(
        clinicDetailDisplayFacilityProvider(facilityId),
      );
      lat = display?.address?.lat;
      lng = display?.address?.lng;
      clinicVerticalIds =
          display?.verticalProfiles.map((p) => p.verticalId) ?? const [];

      if (lat == null || lng == null) {
        // Shared with the detail screen — no duplicate ClinicDetailRepository.
        final dto = await ref
            .watch(clinicDetailRepositoryProvider(facilityId))
            .currentValueOrResolve();
        if (dto == null) return const [];
        lat = dto.address?.lat;
        lng = dto.address?.lng;
        clinicVerticalIds = dto.verticalProfiles.map((p) => p.verticalId);
        if (lat == null || lng == null) return const [];
      }

      final userVerticalIds = await ref.watch(
        currentUserVerticalIdsProvider.future,
      );
      final shared = sharedNearbyVerticalIds(
        clinicVerticalIds: clinicVerticalIds,
        userVerticalIds: userVerticalIds,
      );
      // Prefer clinic-local Linha over Explorar "Todas".
      final clinicLinha = ref.watch(
        clinicDetailActiveLinhaIdProvider(facilityId),
      );
      final selected =
          clinicLinha ?? ref.watch(selectedFacilityVerticalIdProvider);
      final fallback = await ref.watch(
        effectiveFacilityVerticalIdProvider.future,
      );
      final verticalId = resolveNearbyVerticalId(
        sharedVerticalIds: shared,
        selectedVerticalId: selected,
        fallbackEffectiveId: fallback ?? clinicLinha,
      );

      final items = await fetchNearbyFacilities(
        excludeFacilityId: facilityId,
        latitude: lat,
        longitude: lng,
        radiusKm: establishmentNearbyPreviewRadiusKm,
        verticalId: verticalId,
      );
      return applyNearbyVerticalScope(
        items: items,
        sharedVerticalIds: shared,
        queryVerticalId: verticalId,
      );
    });

/// Full-screen map: refetch when radius, origin or vertical changes.
final facilityNearbyProvider =
    FutureProvider.family<List<NearbyEstablishment>, NearbyFacilitiesQuery>((
      ref,
      query,
    ) async {
      if (isMockNearbyFacilityId(query.facilityId)) {
        return const [];
      }

      return fetchNearbyFacilities(
        excludeFacilityId: query.facilityId,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        verticalId: query.verticalId,
      );
    });

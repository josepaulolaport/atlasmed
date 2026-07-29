import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

/// Query key for establishment-centered proximity search.
class NearbyFacilitiesQuery {
  const NearbyFacilitiesQuery({
    required this.facilityId,
    required this.latitude,
    required this.longitude,
    required this.radiusKm,
  });

  final String facilityId;
  final double latitude;
  final double longitude;
  final double radiusKm;

  @override
  bool operator ==(Object other) {
    return other is NearbyFacilitiesQuery &&
        other.facilityId == facilityId &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm;
  }

  @override
  int get hashCode => Object.hash(facilityId, latitude, longitude, radiusKm);
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
        lat = dto.lat;
        lng = dto.lng;
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
      );
    });

/// Full-screen map: refetch when radius (or origin) changes.
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
      );
    });

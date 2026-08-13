import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Builds map center from live facility detail coordinates.
EstablishmentLocation? establishmentLocationFromDetail(Facility facility) {
  final lat = facility.address?.lat;
  final lng = facility.address?.lng;
  if (lat == null || lng == null) return null;

  return EstablishmentLocation(
    latitude: lat,
    longitude: lng,
    formattedAddress: facility.address?.formattedAddress,
  );
}

/// Clinic verticals the signed-in user can also see (intersection).
Set<int> sharedNearbyVerticalIds({
  required Iterable<int> clinicVerticalIds,
  required Iterable<int> userVerticalIds,
}) {
  final user = userVerticalIds.toSet();
  if (user.isEmpty) return clinicVerticalIds.toSet();
  return clinicVerticalIds.where(user.contains).toSet();
}

/// Vertical id for nearby `GET /facilities` given clinic∩user scope.
///
/// - empty shared → [fallbackEffectiveId] (user-only filter)
/// - one shared → that id
/// - many shared → [selectedVerticalId] when in shared, else `null` (Todas)
int? resolveNearbyVerticalId({
  required Set<int> sharedVerticalIds,
  int? selectedVerticalId,
  int? fallbackEffectiveId,
}) {
  if (sharedVerticalIds.isEmpty) return fallbackEffectiveId;
  if (sharedVerticalIds.length == 1) return sharedVerticalIds.single;
  if (selectedVerticalId != null &&
      sharedVerticalIds.contains(selectedVerticalId)) {
    return selectedVerticalId;
  }
  return null;
}

/// When "Todas" among several shared verticals, drop clinics outside that set.
List<NearbyEstablishment> filterNearbyBySharedVerticals(
  List<NearbyEstablishment> items,
  Set<int> sharedVerticalIds,
) {
  if (sharedVerticalIds.isEmpty) return items;
  return items
      .where((e) => e.verticals.any((v) => sharedVerticalIds.contains(v.id)))
      .toList(growable: false);
}

List<NearbyEstablishment> applyNearbyVerticalScope({
  required List<NearbyEstablishment> items,
  required Set<int> sharedVerticalIds,
  int? queryVerticalId,
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

  final int facilityId;
  final double latitude;
  final double longitude;
  final double radiusKm;
  final int? verticalId;

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
    FutureProvider.family<List<NearbyEstablishment>, int>((
      ref,
      facilityId,
    ) async {
      double? lat;
      double? lng;
      Iterable<int> clinicVerticalIds = const [];

      // Select the three values this actually uses, not the whole facility.
      //
      // `clinicDetailDisplayFacilityProvider` is "loaded detail, else navigation
      // shell", so it changes identity the moment the detail lands — and every
      // change re-ran this provider, and every run is a `/facilities` request.
      // Measured 2026-08-13: opening one clinic issued four of them. The
      // coordinates and linhas are usually identical across those rebuilds; a
      // select means only a real change costs a request.
      final (lat0, lng0, verticalIds) = ref.watch(
        clinicDetailDisplayFacilityProvider(facilityId).select(
          (f) => (
            f?.address?.lat,
            f?.address?.lng,
            f?.verticalProfiles.map((p) => p.verticalId).join(",") ?? "",
          ),
        ),
      );
      lat = lat0;
      lng = lng0;
      clinicVerticalIds = verticalIds.isEmpty
          ? const <int>[]
          : verticalIds.split(",").map(int.parse);

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
        verticalId: verticalId,
      );
      return applyNearbyVerticalScope(
        items: items,
        sharedVerticalIds: shared,
        queryVerticalId: verticalId,
      );
    });

/// Full-screen map: refetch when radius / origin / vertical changes.
final facilityNearbyProvider =
    FutureProvider.family<List<NearbyEstablishment>, NearbyFacilitiesQuery>((
      ref,
      query,
    ) async {
      return fetchNearbyFacilities(
        excludeFacilityId: query.facilityId,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        verticalId: query.verticalId,
      );
    });

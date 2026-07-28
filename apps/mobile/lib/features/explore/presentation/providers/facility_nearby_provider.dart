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
Set<String> sharedNearbyVerticalIds({
  required Iterable<String> clinicVerticalIds,
  required Iterable<String> userVerticalIds,
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

/// When "Todas" among several shared verticals, drop clinics outside that set.
List<NearbyEstablishment> filterNearbyBySharedVerticals(
  List<NearbyEstablishment> items,
  Set<String> sharedVerticalIds,
) {
  if (sharedVerticalIds.isEmpty) return items;
  return items
      .where((e) => e.verticals.any((v) => sharedVerticalIds.contains(v.id)))
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
final facilityNearbyPreviewProvider =
    FutureProvider.family<List<NearbyEstablishment>, String>((
      ref,
      facilityId,
    ) async {
      if (isMockNearbyFacilityId(facilityId)) {
        return const [];
      }

      final repo = ref.watch(clinicDetailRepositoryProvider(facilityId));
      final dto = await repo.currentValueOrResolve();
      if (dto == null) return const [];
      final lat = dto.lat;
      final lng = dto.lng;
      if (lat == null || lng == null) return const [];

      final userVerticalIds = await ref.watch(
        currentUserVerticalIdsProvider.future,
      );
      final shared = sharedNearbyVerticalIds(
        clinicVerticalIds: dto.verticalProfiles.map((p) => p.verticalId),
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

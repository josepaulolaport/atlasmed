import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

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

      return fetchNearbyFacilities(
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

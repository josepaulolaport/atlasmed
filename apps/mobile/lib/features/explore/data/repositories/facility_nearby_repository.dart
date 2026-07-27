import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';

/// Fetches in-scope facilities near a reference point (establishment-centered).
///
/// Distance in the response is from [latitude]/[longitude], not the user.
Future<List<NearbyEstablishment>> fetchNearbyFacilities({
  String excludeFacilityId = '',
  required double latitude,
  required double longitude,
  required double radiusKm,
  int limit = 100,
  String? verticalId,
}) async {
  final repo = ClinicsRepository(
    page: 1,
    limit: limit,
    latitude: latitude,
    longitude: longitude,
    radiusKm: radiusKm,
    verticalId: verticalId,
  );
  try {
    final page = await repo.currentValueOrResolve();
    final items = page?.items ?? const <FacilityDTO>[];
    return items
        .where(
          (facility) =>
              excludeFacilityId.isEmpty || facility.id != excludeFacilityId,
        )
        .where((facility) => facility.lat != null && facility.lng != null)
        .map(facilityToNearbyEstablishment)
        .toList(growable: false);
  } finally {
    repo.dispose();
  }
}

NearbyEstablishment facilityToNearbyEstablishment(FacilityDTO facility) {
  return NearbyEstablishment(
    id: facility.id,
    name: facility.name,
    latitude: facility.lat!,
    longitude: facility.lng!,
    distanceKm: facility.distanceKm ?? 0,
    specialtyLabel: _specialtyLabel(facility),
    status: ClinicStatus.active,
    neighborhood: facility.neighborhood,
    streetAddress: facility.streetAddress,
    streetNumber: facility.streetNumber,
    addressComplement: facility.addressComplement,
  );
}

String? _specialtyLabel(FacilityDTO facility) {
  final neighborhood = facility.neighborhood?.trim();
  if (neighborhood != null && neighborhood.isNotEmpty) return neighborhood;
  final city = facility.city?.trim();
  if (city != null && city.isNotEmpty) return city;
  return null;
}

bool isMockNearbyFacilityId(String facilityId) =>
    facilityId.startsWith('near-') || facilityId.endsWith(':empty');

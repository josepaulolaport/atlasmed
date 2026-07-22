import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';

/// Fetches in-scope facilities near a reference point (establishment-centered).
///
/// Distance in the response is from [latitude]/[longitude], not the user.
Future<List<NearbyEstablishment>> fetchNearbyFacilities({
  required String excludeFacilityId,
  required double latitude,
  required double longitude,
  required double radiusKm,
  int limit = 100,
}) async {
  final repo = ClinicsRepository(
    page: 1,
    limit: limit,
    latitude: latitude,
    longitude: longitude,
    radiusKm: radiusKm,
  );
  try {
    final page = await repo.currentValueOrResolve();
    final items = page?.items ?? const <api.Clinic>[];
    return items
        .where((clinic) => clinic.id != excludeFacilityId)
        .where((clinic) => clinic.lat != null && clinic.lng != null)
        .map(clinicToNearbyEstablishment)
        .toList(growable: false);
  } finally {
    repo.dispose();
  }
}

NearbyEstablishment clinicToNearbyEstablishment(api.Clinic clinic) {
  return NearbyEstablishment(
    id: clinic.id,
    name: clinic.name,
    latitude: clinic.lat!,
    longitude: clinic.lng!,
    distanceKm: clinic.distanceKm ?? 0,
    specialtyLabel: _specialtyLabel(clinic),
    status: ClinicStatus.active,
    neighborhood: clinic.neighborhood,
    streetAddress: clinic.streetAddress,
    streetNumber: clinic.streetNumber,
    addressComplement: clinic.addressComplement,
  );
}

String? _specialtyLabel(api.Clinic clinic) {
  final neighborhood = clinic.neighborhood?.trim();
  if (neighborhood != null && neighborhood.isNotEmpty) return neighborhood;
  final city = clinic.city?.trim();
  if (city != null && city.isNotEmpty) return city;
  return null;
}

bool isMockNearbyFacilityId(String facilityId) =>
    facilityId.startsWith('near-') || facilityId.endsWith(':empty');

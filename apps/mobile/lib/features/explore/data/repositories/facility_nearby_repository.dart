import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/data_source.dart';

EstablishmentLocation? establishmentLocationFromFacility(Facility facility) {
  final lat = facility.address?.lat;
  final lng = facility.address?.lng;
  if (lat == null || lng == null) return null;

  return EstablishmentLocation(
    latitude: lat,
    longitude: lng,
    formattedAddress: facility.address?.formattedAddress,
  );
}

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
  final purchaseBucket =
      PurchaseBucketFilter.fromFunnelApi(
        facility.purchaseRecurrence?.rawFunnelStage ??
            facility.purchaseRecurrence?.funnelStage?.apiValue,
      ) ??
      PurchaseBucketFilter.neverBought;
  return NearbyEstablishment(
    id: facility.id,
    name: facility.name,
    latitude: facility.lat!,
    longitude: facility.lng!,
    distanceKm: facility.distanceKm ?? 0,
    specialtyLabel: _specialtyLabel(facility),
    purchaseBucket: purchaseBucket,
    status: _statusForBucket(purchaseBucket),
    neighborhood: facility.neighborhood,
    streetAddress: facility.streetAddress,
    streetNumber: facility.streetNumber,
    addressComplement: facility.addressComplement,
    verticals: facility.verticalProfiles
        .map(
          (p) => NearbyVerticalBadge(
            id: p.verticalId,
            name: p.verticalName.isNotEmpty ? p.verticalName : p.verticalId,
          ),
        )
        .toList(growable: false),
  );
}

ClinicStatus _statusForBucket(String bucket) => switch (bucket) {
  PurchaseBucketFilter.active => ClinicStatus.active,
  PurchaseBucketFilter.inactive => ClinicStatus.inactive,
  _ => ClinicStatus.rejected,
};

String? _specialtyLabel(FacilityDTO facility) {
  final neighborhood = facility.neighborhood?.trim();
  if (neighborhood != null && neighborhood.isNotEmpty) return neighborhood;
  final city = facility.city?.trim();
  if (city != null && city.isNotEmpty) return city;
  return null;
}

bool isMockNearbyFacilityId(String facilityId) =>
    facilityId.startsWith('near-') || facilityId.endsWith(':empty');

/// Facility-centered proximity repository used by the detail aggregate.
///
/// Coordinates come from [detailRepository], so the caller only needs the
/// facility id. The owning aggregate coordinates refresh order so proximity
/// always uses the latest facility coordinates.
class FacilityNearbyRepository
    extends BaseRepository<List<NearbyEstablishment>> {
  FacilityNearbyRepository({
    required this.facilityId,
    required this.detailRepository,
    this.verticalId,
  }) : super(resolveOnCreate: false);

  final String facilityId;
  final ClinicDetailRepository detailRepository;
  final String? verticalId;

  @override
  String get name => 'FacilityNearbyRepository';

  @override
  Future<List<NearbyEstablishment>?> hydratate({
    bool refreshAfter = true,
  }) async {
    return refreshAfter ? refresh() : null;
  }

  @override
  Future<List<NearbyEstablishment>> refresh() async {
    if (isMockNearbyFacilityId(facilityId)) {
      const nearby = <NearbyEstablishment>[];
      await emit(data: nearby);
      return nearby;
    }

    final facility = await detailRepository.currentValueOrResolve();
    final location = facility == null
        ? null
        : establishmentLocationFromFacility(facility);
    if (location == null) {
      const nearby = <NearbyEstablishment>[];
      await emit(data: nearby);
      return nearby;
    }

    final nearby = await fetchNearbyFacilities(
      excludeFacilityId: facilityId,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: establishmentNearbyPreviewRadiusKm,
      verticalId: verticalId,
    );
    await emit(data: nearby, datasource: RepositoryDatasource.remote);
    return nearby;
  }

  @override
  Future<String?> resolve() async => null;

  @override
  List<NearbyEstablishment> fromJson(String json) => const [];
}

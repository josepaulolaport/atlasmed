import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_payer_shares_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/repository/repositories/zip_repository.dart';

/// Combines detail + related data repositories into a single [Facility] stream.
///
/// Each sub-repository fetches one slice of the full facility profile.
/// The [zipper] merges them into a complete [Facility] whenever any
/// sub-repository emits a new value.
class FacilityZipRepository extends ZipRepository<Facility> {
  FacilityZipRepository(String facilityId, {String? verticalId})
    : super(
        repositories: [
          ClinicDetailRepository(id: facilityId, verticalId: verticalId),
          FacilityPhotosRepository(facilityId),
          FacilityOrdersRepository(facilityId: facilityId, page: 1, limit: 5),
          FacilityPayerSharesRepository(facilityId),
          FacilityRepresentativesRepository(facilityId),
        ],
      );

  @override
  Facility zipper(List<dynamic> values) {
    final dto = values[0] as FacilityDTO?;
    final photosResponse = values[1] as FacilityPhotosResponse?;
    final ordersPage = values[2] as FacilityOrdersPage?;
    final payerResponse = values[3] as FacilityPayerSharesResponse?;
    final repPage = values[4] as PaginatedFacilityRepresentatives?;

    final base = dto != null
        ? Facility.fromDTO(dto)
        : Facility(id: '', name: '');

    return Facility(
      id: base.id,
      name: base.name,
      address: base.address,
      contact: base.contact,
      commercial: base.commercial,
      territory: base.territory,
      registration: base.registration,
      distanceKm: base.distanceKm,
      purchaseRecurrence: base.purchaseRecurrence,
      professionalCount: base.professionalCount,
      imageUrl: base.imageUrl,
      services: base.services,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      photos: photosResponse != null ? [photosResponse.toSummary()] : const [],
      orders: ordersPage?.orders ?? const [],
      payerShares: payerResponse?.toDomain() ?? const [],
      representatives:
          repPage?.items.map((r) => r.toDomain()).toList(growable: false) ??
          const [],
      fieldNotes: base.fieldNotes,
    );
  }
}

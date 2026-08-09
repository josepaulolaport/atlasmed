import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/repository/repositories/zip_repository.dart';

/// Detail + photos only. Orders / payers / reps live in dedicated Riverpod
/// notifiers so Linha changes and section edits do not refetch the whole page.
typedef FacilityWithIntegrations = ({
  Facility? facility,
  List<PhotoGallerySummary> photos,
});

/// Combines shared detail + photos repositories into one stream.
///
/// Children are owned by Riverpod providers — this zip must not create or
/// dispose them. Linha-scoped detail swaps keep the photos repo alive.
class FacilityZipRepository extends ZipRepository<FacilityWithIntegrations> {
  FacilityZipRepository({
    required this.detail,
    required this.photos,
    this.verticalId,
  }) : super(repositories: [detail, photos]);

  final ClinicDetailRepository detail;
  final FacilityPhotosRepository photos;
  final int? verticalId;

  Future<FacilityPhotosResponse?> refreshPhotos() => photos.refresh();

  @override
  FacilityWithIntegrations zipper(List<dynamic> values) {
    final dto = values[0] as FacilityDTO?;
    final photosResponse = values[1] as FacilityPhotosResponse?;

    // ZipRepository uses CombineLatestStream — photos often emit before
    // clinic detail on slower networks. Never invent an empty Facility.
    final facility = dto == null
        ? null
        : Facility.fromDTO(dto, verticalId: verticalId);

    return (
      facility: facility,
      photos: photosResponse != null ? [photosResponse.toSummary()] : const [],
    );
  }
}

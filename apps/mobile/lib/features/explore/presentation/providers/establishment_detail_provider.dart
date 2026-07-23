import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';

/// Section shell for establishment detail.
///
/// Real facilities no longer pull Phase-1 mock bundles (purchase signals,
/// fake nearby pins, invented specialties). Empty sections mean "not on API
/// yet" — individual providers (roster, notes, photos, payers) load live data.
final establishmentDetailSectionsProvider =
    FutureProvider.family<EstablishmentDetailSections, String>((
      ref,
      facilityId,
    ) async {
      if (isMockNearbyFacilityId(facilityId)) {
        return const EstablishmentDetailSections();
      }
      return const EstablishmentDetailSections();
    });

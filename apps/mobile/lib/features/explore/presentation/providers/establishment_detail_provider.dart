import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Section shell for establishment detail.
///
/// Empty shell — individual providers (roster, notes, photos, payers) load
/// live API data. Kept as a typed container for section widgets that still
/// read shared location/contact fields when present.
final establishmentDetailSectionsProvider =
    FutureProvider.family<EstablishmentDetailSections, int>((
      ref,
      facilityId,
    ) async {
      return const EstablishmentDetailSections();
    });

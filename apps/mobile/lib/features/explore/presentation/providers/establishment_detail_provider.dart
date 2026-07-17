import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Phase 1: mocked establishment detail sections.
/// Phase 3 replaces this with real API repositories.
final establishmentDetailSectionsProvider =
    FutureProvider.family<EstablishmentDetailSections, String>((
      ref,
      facilityId,
    ) async {
      await Future<void>.delayed(const Duration(milliseconds: 400));
      return mockEstablishmentDetailSections(facilityId);
    });

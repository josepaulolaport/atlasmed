import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Phase 1: mocked establishment detail sections.
/// Phase 3 replaces this with real API repositories.
///
/// Errors are rethrown so section cards can show retry UI. Pass a facility id
/// ending in `:empty` to exercise empty-roster fallbacks in Phase 1.
final establishmentDetailSectionsProvider =
    FutureProvider.family<EstablishmentDetailSections, String>((
      ref,
      facilityId,
    ) async {
      await Future<void>.delayed(const Duration(milliseconds: 400));
      try {
        if (facilityId.endsWith(':empty')) {
          return mockEmptyEstablishmentDetailSections(facilityId);
        }
        return mockEstablishmentDetailSections(facilityId);
      } catch (error) {
        Error.throwWithStackTrace(
          Exception('Falha ao carregar seções do estabelecimento: $error'),
          StackTrace.current,
        );
      }
    });

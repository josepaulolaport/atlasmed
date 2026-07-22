import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';

final facilityNotesRepositoryProvider = Provider.autoDispose
    .family<FacilityNotesRepository, String>((ref, facilityId) {
      final repository = FacilityNotesRepository(facilityId);
      ref.onDispose(repository.dispose);
      return repository;
    });

final facilityNotesProvider = FutureProvider.autoDispose
    .family<List<FacilityFieldNote>, String>((ref, facilityId) async {
      if (facilityId.startsWith('near-') || facilityId.endsWith(':empty')) {
        final sections = facilityId.endsWith(':empty')
            ? mockEmptyEstablishmentDetailSections(facilityId)
            : mockEstablishmentDetailSections(facilityId);
        return sections.fieldNotes;
      }

      final repo = ref.watch(facilityNotesRepositoryProvider(facilityId));
      return repo.loadNotes();
    });

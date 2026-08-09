import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';

final facilityNotesRepositoryProvider = Provider.autoDispose
    .family<FacilityNotesRepository, int>((ref, facilityId) {
      final repository = FacilityNotesRepository(facilityId);
      ref.onDispose(repository.dispose);
      return repository;
    });

final facilityNotesProvider = FutureProvider.autoDispose
    .family<List<FacilityFieldNote>, int>((ref, facilityId) async {
      final repo = ref.watch(facilityNotesRepositoryProvider(facilityId));
      return repo.loadNotes();
    });

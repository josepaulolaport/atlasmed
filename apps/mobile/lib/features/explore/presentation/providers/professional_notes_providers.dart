import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';

/// Provides a [ProfessionalNotesRepository] for a given person [id].
final professionalNotesRepositoryProvider = Provider.autoDispose
    .family<ProfessionalNotesRepository, int>((ref, personId) {
      final repository = ProfessionalNotesRepository(personId);
      ref.onDispose(repository.dispose);
      return repository;
    });

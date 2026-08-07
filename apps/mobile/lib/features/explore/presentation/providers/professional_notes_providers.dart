import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';

/// Provides a [ProfessionalNotesRepository] for a given professional [id].
final professionalNotesRepositoryProvider = Provider.autoDispose
    .family<ProfessionalNotesRepository, int>((ref, professionalId) {
      final repository = ProfessionalNotesRepository(professionalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

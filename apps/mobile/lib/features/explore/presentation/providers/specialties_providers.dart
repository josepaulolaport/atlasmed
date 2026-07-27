import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_specialties_repository.dart';

/// Provides a [ProfessionalSpecialtiesRepository].
final professionalSpecialtiesRepositoryProvider =
    Provider.autoDispose<ProfessionalSpecialtiesRepository>((ref) {
      final repository = ProfessionalSpecialtiesRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });

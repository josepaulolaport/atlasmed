import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_visits_repository.dart';

/// Provides a [ClinicVisitsRepository] for a given facility [id].
final clinicVisitsRepositoryProvider = Provider.autoDispose
    .family<ClinicVisitsRepository, String>((ref, facilityId) {
      final repository = ClinicVisitsRepository(facilityId);
      ref.onDispose(repository.dispose);
      return repository;
    });

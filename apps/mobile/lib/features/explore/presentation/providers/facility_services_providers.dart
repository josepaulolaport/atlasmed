import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_services_repository.dart';

/// CNES service catalog for Explorar clinic filters (kept alive for chip labels).
final facilityServicesRepositoryProvider =
    Provider<FacilityServicesRepository>((ref) {
      final repository = FacilityServicesRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });

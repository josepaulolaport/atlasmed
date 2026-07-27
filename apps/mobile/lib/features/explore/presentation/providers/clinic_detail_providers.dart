import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';

/// Provides a [ClinicDetailRepository] for a given facility [id].
/// Rebuilds when the effective vertical id resolves so the endpoint URL
/// includes the vertical scope.
final clinicDetailRepositoryProvider = Provider.autoDispose
    .family<ClinicDetailRepository, String>((ref, id) {
      final verticalId = ref
          .watch(effectiveFacilityVerticalIdProvider)
          .valueOrNull;
      final repository = ClinicDetailRepository(id: id, verticalId: verticalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

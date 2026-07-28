import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';

/// Provides a [ClinicDetailRepository] for a given facility [id].
/// Rebuilds when clinic-local Linha (or Explorar fallback) changes.
final clinicDetailRepositoryProvider = Provider.autoDispose
    .family<ClinicDetailRepository, String>((ref, id) {
      final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(id));
      final repository = ClinicDetailRepository(id: id, verticalId: verticalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

/// Provides a [FacilityZipRepository] for a given facility [id].
/// Combines detail + photos + orders + payerShares + representatives reactively.
/// Automatically disposes the repository when the provider is no longer listened to.
final facilityZipRepositoryProvider = Provider.autoDispose
    .family<FacilityZipRepository, String>((ref, id) {
      final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(id));
      final repository = FacilityZipRepository(id, verticalId: verticalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

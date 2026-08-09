import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef FacilityPotentialArgs = ({int facilityId, int verticalId});

final facilityPotentialsProvider = FutureProvider.autoDispose
    .family<FacilityPotentialsPage, FacilityPotentialArgs>((ref, args) async {
      final repo = FacilityPotentialRepository(
        facilityId: args.facilityId,
        verticalId: args.verticalId,
      );
      ref.onDispose(repo.dispose);
      return repo.load();
    });

/// Resolves active Linha then loads potentials for the clinic.
final clinicDetailPotentialsProvider = FutureProvider.autoDispose
    .family<FacilityPotentialsPage?, int>((ref, facilityId) async {
      final verticalId = ref.watch(
        clinicDetailActiveLinhaIdProvider(facilityId),
      );
      if (verticalId == null || (verticalId <= 0)) return null;
      return ref.watch(
        facilityPotentialsProvider((
          facilityId: facilityId,
          verticalId: verticalId,
        )).future,
      );
    });

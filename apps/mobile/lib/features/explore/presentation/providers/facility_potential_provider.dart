import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef FacilityPotentialArgs = ({int facilityId, int verticalId});

/// The potential page for one clinic-linha.
///
/// A notifier rather than a plain future because every write already answers
/// the question this provider asks: the server recomputes and returns the whole
/// page, so re-fetching it would be asking twice and risking two answers. The
/// write hands the page straight in through [applyServerPage].
class FacilityPotentials
    extends
        AutoDisposeFamilyAsyncNotifier<
          FacilityPotentialsPage,
          FacilityPotentialArgs
        > {
  @override
  Future<FacilityPotentialsPage> build(FacilityPotentialArgs arg) async {
    final repo = FacilityPotentialRepository(
      facilityId: arg.facilityId,
      verticalId: arg.verticalId,
    );
    ref.onDispose(repo.dispose);
    return repo.load();
  }

  /// Adopts the page a write returned.
  ///
  /// This is the recomputed answer, produced inside the same request that made
  /// the change, so the screen updates the moment the sheet closes — no second
  /// round trip, and no window where the rep reads the figure they just
  /// replaced.
  void applyServerPage(FacilityPotentialsPage page) {
    state = AsyncData(page);
  }
}

final facilityPotentialsProvider = AsyncNotifierProvider.autoDispose
    .family<FacilityPotentials, FacilityPotentialsPage, FacilityPotentialArgs>(
      FacilityPotentials.new,
    );

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

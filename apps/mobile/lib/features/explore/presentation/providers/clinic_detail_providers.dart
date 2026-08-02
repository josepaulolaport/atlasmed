import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/repository_state.dart';

/// Shell hint from list/map navigation — paints header before detail returns.
final clinicDetailShellFacilityProvider = StateProvider.autoDispose
    .family<Facility?, String>((ref, facilityId) => null);

/// Last successful detail payload — survives Linha-scoped detail refetch.
final clinicDetailLoadedFacilityProvider = StateProvider.autoDispose
    .family<Facility?, String>((ref, facilityId) => null);

/// Prefer loaded detail, else navigation shell.
final clinicDetailDisplayFacilityProvider = Provider.autoDispose
    .family<Facility?, String>((ref, facilityId) {
      return ref.watch(clinicDetailLoadedFacilityProvider(facilityId)) ??
          ref.watch(clinicDetailShellFacilityProvider(facilityId));
    });

/// Widget-side shell seed (WidgetRef ≠ Ref in riverpod 2).
void seedClinicDetailShellFromDto(WidgetRef ref, FacilityDTO dto) {
  ref.read(clinicDetailShellFacilityProvider(dto.id).notifier).state =
      Facility.fromDTO(dto);
}

void seedClinicDetailShellFromEntry(WidgetRef ref, FacilityEntry entry) {
  ref
      .read(clinicDetailShellFacilityProvider(entry.id).notifier)
      .state = Facility(
    id: entry.id,
    name: entry.name,
    address: FacilityAddress(
      neighborhood: entry.neighborhood ?? '',
      city: entry.city,
    ),
    commercial: FacilityCommercial(
      commercialStatus: entry.commercialStatus,
      doctorCount: entry.doctorCount,
    ),
    distanceKm: entry.distanceKm,
    purchaseRecurrence: entry.purchaseRecurrence,
    professionalCount: entry.doctorCount,
    services: entry.services,
    verticalProfiles: entry.verticalProfiles,
  );
}

void seedClinicDetailShellFromNearby(
  WidgetRef ref,
  NearbyEstablishment nearby,
) {
  ref
      .read(clinicDetailShellFacilityProvider(nearby.id).notifier)
      .state = Facility(
    id: nearby.id,
    name: nearby.name,
    address: FacilityAddress(
      streetAddress: nearby.streetAddress,
      streetNumber: nearby.streetNumber,
      addressComplement: nearby.addressComplement,
      neighborhood: nearby.neighborhood ?? '',
      city: '',
      lat: nearby.latitude,
      lng: nearby.longitude,
    ),
    distanceKm: nearby.distanceKm,
    verticalProfiles: nearby.verticals
        .map(
          (v) => FacilityVerticalProfileDTO(
            verticalId: v.id,
            verticalName: v.name,
          ),
        )
        .toList(growable: false),
  );
}

/// Vertical-scoped facility detail. Recreates only when active Linha changes.
final clinicDetailRepositoryProvider = Provider.autoDispose
    .family<ClinicDetailRepository, String>((ref, id) {
      final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(id));
      final repository = ClinicDetailRepository(id: id, verticalId: verticalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

/// Provides a [FacilityZipRepository] for a given facility [id].
/// Owns and combines the facility detail with every related read model.
/// Automatically disposes the repository when the provider is no longer listened to.
final facilityZipRepositoryProvider = Provider.autoDispose
    .family<FacilityZipRepository, String>((ref, id) {
      final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(id));
      final repository = FacilityZipRepository(id, verticalId: verticalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

typedef ClinicDetailScopeArgs = ({
  String facilityId,
  String? initialVerticalId,
});

/// Synchronizes route context and loaded facility profiles outside the widget.
final clinicDetailScopeProvider = Provider.autoDispose
    .family<void, ClinicDetailScopeArgs>((ref, args) {
      final facilityId = args.facilityId;
      final initialVerticalId = args.initialVerticalId;
      final entryVerticalId = ref.watch(
        clinicDetailEntryVerticalIdProvider(facilityId),
      );
      if (initialVerticalId != null &&
          initialVerticalId.isNotEmpty &&
          entryVerticalId != initialVerticalId) {
        Future.microtask(() {
          ref
                  .read(
                    clinicDetailEntryVerticalIdProvider(facilityId).notifier,
                  )
                  .state =
              initialVerticalId;
        });
      }

      final repository = ref.watch(facilityZipRepositoryProvider(facilityId));
      final subscription = repository.stream.listen((state) {
        if (state case RepositoryStateReady(data: final data)) {
          final facility = data.facility;
          if (facility != null && facility.id.isNotEmpty) {
            ref
                    .read(
                      clinicDetailLoadedFacilityProvider(facilityId).notifier,
                    )
                    .state =
                facility;
          }
          final profileIds = facility?.verticalProfiles
              .map((profile) => profile.verticalId)
              .where((id) => id.isNotEmpty)
              .toSet();
          if (profileIds == null || profileIds.isEmpty) return;
          final current = ref.read(
            clinicDetailKnownProfileIdsProvider(facilityId),
          );
          if (_sameIds(current, profileIds)) return;
          ref
                  .read(
                    clinicDetailKnownProfileIdsProvider(facilityId).notifier,
                  )
                  .state =
              profileIds;
        }
      });
      ref.onDispose(subscription.cancel);
    });

bool _sameIds(Set<String> left, Set<String> right) =>
    left.length == right.length && left.containsAll(right);

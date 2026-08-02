import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';

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
  ref.read(clinicDetailShellFacilityProvider(entry.id).notifier).state =
      Facility(
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

void seedClinicDetailShellFromNearby(WidgetRef ref, NearbyEstablishment nearby) {
  ref.read(clinicDetailShellFacilityProvider(nearby.id).notifier).state =
      Facility(
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

/// Photos are not Linha-scoped — stable across detail vertical swaps.
final facilityPhotosRepositoryProvider = Provider.autoDispose
    .family<FacilityPhotosRepository, String>((ref, id) {
      final repository = FacilityPhotosRepository(id);
      ref.onDispose(repository.dispose);
      return repository;
    });

/// Detail + photos zip. Photos child survives Linha-driven detail recreate.
final facilityZipRepositoryProvider = Provider.autoDispose
    .family<FacilityZipRepository, String>((ref, id) {
      final detail = ref.watch(clinicDetailRepositoryProvider(id));
      final photos = ref.watch(facilityPhotosRepositoryProvider(id));
      final repository = FacilityZipRepository(detail: detail, photos: photos);
      ref.onDispose(repository.dispose);
      return repository;
    });

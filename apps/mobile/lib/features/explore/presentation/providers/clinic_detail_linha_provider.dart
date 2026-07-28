import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Explicit Linha pick **inside** clinic detail. Does not touch Explorar filter.
///
/// `null` = not overridden yet → [clinicDetailActiveLinhaIdProvider] falls back
/// to entry / Explorar / Dashboard / first shared option.
final clinicDetailSelectedLinhaIdProvider = StateProvider.autoDispose
    .family<String?, String>((ref, facilityId) => null);

/// Vertical id from navigation (e.g. Desempenho bucket `?verticalId=`).
/// Set once when opening clinic detail; cleared with autoDispose.
final clinicDetailEntryVerticalIdProvider = StateProvider.autoDispose
    .family<String?, String>((ref, facilityId) => null);

/// Clinic vertical profile ids learned after first detail/zip load.
///
/// Used to intersect with user options without circular dependency on the
/// scoped repository (bootstrap uses user options alone until this is set).
final clinicDetailKnownProfileIdsProvider = StateProvider.autoDispose
    .family<Set<String>, String>((ref, facilityId) => const {});

/// User ∩ clinic verticals as switcher options.
List<BusinessVertical> clinicDetailLinhaOptions({
  required List<BusinessVertical> userOptions,
  required List<FacilityVerticalProfileDTO> clinicProfiles,
}) {
  final clinicIds = clinicProfiles
      .where((p) => p.verticalId.isNotEmpty)
      .map((p) => p.verticalId)
      .toSet();
  if (clinicIds.isEmpty) return const [];
  return userOptions
      .where((v) => clinicIds.contains(v.id))
      .toList(growable: false);
}

/// Whether to show the clinic Linha switcher (both sides have 2+ shared).
bool shouldShowClinicDetailLinhaSwitcher(List<BusinessVertical> options) =>
    options.length >= 2;

/// Resolve active Linha once clinic profiles / user options are known.
///
/// Priority: clinic override → route/entry hint → Explorar → Dashboard →
/// first shared option.
String? resolveClinicDetailActiveLinhaId({
  required List<BusinessVertical> options,
  required String? clinicOverride,
  required String? entryVerticalId,
  required String? exploreSelected,
  required String? dashboardSelected,
  required String? effectiveFallback,
}) {
  if (options.isEmpty) return effectiveFallback;
  if (options.length == 1) return options.first.id;
  bool inOptions(String? id) => id != null && options.any((v) => v.id == id);
  if (inOptions(clinicOverride)) return clinicOverride;
  if (inOptions(entryVerticalId)) return entryVerticalId;
  if (inOptions(exploreSelected)) return exploreSelected;
  if (inOptions(dashboardSelected)) return dashboardSelected;
  return options.first.id;
}

/// Active Linha for clinic detail sections (never "Todas" when 2+ shared).
final clinicDetailActiveLinhaIdProvider = Provider.autoDispose
    .family<String?, String>((ref, facilityId) {
      final userOptions =
          ref.watch(currentUserFacilityVerticalOptionsProvider).valueOrNull ??
          const <BusinessVertical>[];
      final knownIds = ref.watch(
        clinicDetailKnownProfileIdsProvider(facilityId),
      );
      final override = ref.watch(
        clinicDetailSelectedLinhaIdProvider(facilityId),
      );
      final entryVerticalId = ref.watch(
        clinicDetailEntryVerticalIdProvider(facilityId),
      );
      final exploreSelected = ref.watch(selectedFacilityVerticalIdProvider);
      final dashboardSelected = ref.watch(dashboardSelectedVerticalIdProvider);
      final effective = ref
          .watch(effectiveFacilityVerticalIdProvider)
          .valueOrNull;

      final options = knownIds.isEmpty
          ? userOptions
          : userOptions
                .where((v) => knownIds.contains(v.id))
                .toList(growable: false);

      return resolveClinicDetailActiveLinhaId(
        options: options,
        clinicOverride: override,
        entryVerticalId: entryVerticalId,
        exploreSelected: exploreSelected,
        dashboardSelected: dashboardSelected,
        effectiveFallback: effective,
      );
    });

/// True when active clinic Linha is Ortopedia (payers apply).
bool isClinicLinhaOrtopedia({
  required List<FacilityVerticalProfileDTO> profiles,
  required String? activeVerticalId,
}) {
  if (activeVerticalId == null) {
    // Single-profile / unscored: any ortho profile counts.
    return profiles.any(_profileIsOrtopedia);
  }
  for (final p in profiles) {
    if (p.verticalId == activeVerticalId) return _profileIsOrtopedia(p);
  }
  return false;
}

bool _profileIsOrtopedia(FacilityVerticalProfileDTO p) {
  final code = (p.verticalCode ?? '').toUpperCase();
  final name = p.verticalName.toUpperCase();
  return code.contains('ORTOPEDIA') || name.contains('ORTOP');
}

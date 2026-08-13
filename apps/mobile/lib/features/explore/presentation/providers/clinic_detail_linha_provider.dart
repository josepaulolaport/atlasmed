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
    .family<int?, int>((ref, facilityId) => null);

/// Vertical id from navigation (e.g. Desempenho bucket `?verticalId=`).
/// Set once when opening clinic detail; cleared with autoDispose.
final clinicDetailEntryVerticalIdProvider = StateProvider.autoDispose
    .family<int?, int>((ref, facilityId) => null);

/// Clinic vertical profile ids, seeded from the list row at tap time and
/// refreshed from the detail response.
///
/// Used to intersect with user options without circular dependency on the
/// scoped repository (bootstrap uses user options alone until this is set).
///
/// Deliberately **not** autoDispose, unlike its neighbours here.
///
/// The seed arrives before anything listens: the tap handler writes the ids and
/// returns, the route builds a frame or more later, and only then does a widget
/// subscribe. autoDispose collected the value in that gap — measured
/// 2026-08-13, a seeded `{7}` read back as `{}` two frames later. So every
/// clinic opened with the linha still unresolved, and every linha-scoped
/// provider ran twice: once on the provisional `null` and again on the real id.
/// Four duplicate requests per clinic open, discarding an answer the client had
/// already computed.
///
/// Keeping it means visited clinics hold a small `Set<int>` for the session.
/// That is the right trade here because these ids are a fact about the clinic
/// rather than a user choice — unlike [clinicDetailSelectedLinhaIdProvider],
/// which must reset between visits. Persisting them also makes a second visit
/// resolve the linha on the first build with no round trip at all.
final clinicDetailKnownProfileIdsProvider = StateProvider.family<Set<int>, int>(
  (ref, facilityId) => const {},
);

/// User ∩ clinic verticals as switcher options.
List<BusinessVertical> clinicDetailLinhaOptions({
  required List<BusinessVertical> userOptions,
  required List<FacilityVerticalProfileDTO> clinicProfiles,
}) {
  final clinicIds = clinicProfiles
      .where((p) => p.verticalId > 0)
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
int? resolveClinicDetailActiveLinhaId({
  required List<BusinessVertical> options,
  required int? clinicOverride,
  int? entryVerticalId,
  required int? exploreSelected,
  required int? dashboardSelected,
  required int? effectiveFallback,
}) {
  if (options.isEmpty) return effectiveFallback;
  if (options.length == 1) return options.first.id;
  bool inOptions(int? id) => id != null && options.any((v) => v.id == id);
  if (inOptions(clinicOverride)) return clinicOverride;
  if (inOptions(entryVerticalId)) return entryVerticalId;
  if (inOptions(exploreSelected)) return exploreSelected;
  if (inOptions(dashboardSelected)) return dashboardSelected;
  return options.first.id;
}

/// Active Linha for clinic detail sections (never "Todas" when 2+ shared).
final clinicDetailActiveLinhaIdProvider = Provider.autoDispose
    .family<int?, int>((ref, facilityId) {
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

      // Bootstrap (profiles unknown): do not send Explorar/Dashboard Linha —
      // wrong Linha 404s detail (e.g. Orto clinic while filter is Derm) and
      // blocks learning clinic profiles. Entry hint still allowed.
      if (knownIds.isEmpty) {
        return override ?? entryVerticalId;
      }

      final options = userOptions
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
  int? activeVerticalId,
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

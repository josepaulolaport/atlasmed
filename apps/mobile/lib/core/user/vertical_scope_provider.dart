import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Current user's business vertical assignments from `GET /user/assignments`.
final currentUserVerticalAssignmentsProvider =
    FutureProvider<List<UserVerticalAssignment>>((ref) async {
      ref.watch(sessionProvider);
      final repo = ref.watch(userAssignmentsProvider);
      final assignments = await repo.currentValueOrResolve();
      if (assignments == null) return const [];
      return assignments.verticals;
    });

/// Current user's business vertical ids.
final currentUserVerticalIdsProvider = FutureProvider<List<int>>((ref) async {
  final verticals = await ref.watch(
    currentUserVerticalAssignmentsProvider.future,
  );
  return verticals.map((v) => v.verticalId).toList(growable: false);
});

/// Vertical options for facility/map/explore filter chips.
final currentUserFacilityVerticalOptionsProvider =
    FutureProvider<List<BusinessVertical>>((ref) async {
      final verticals = await ref.watch(
        currentUserVerticalAssignmentsProvider.future,
      );
      return verticals
          .map(
            (v) => BusinessVertical(
              id: v.verticalId,
              slug: '',
              name: v.verticalName,
            ),
          )
          .toList(growable: false);
    });

/// Explicit vertical filter for facilities/map/explore when the user has
/// multiple verticals. `null` means "union of all assigned verticals".
final selectedFacilityVerticalIdProvider = StateProvider<int?>((ref) => null);

/// Vertical id to pass on facility list queries.
///
/// - 0–1 assigned verticals → omit (`null`) so the API uses its default/union.
/// - 2+ verticals → [selectedFacilityVerticalIdProvider] (`null` = Todas / union).
final effectiveFacilityVerticalIdProvider = FutureProvider<int?>((ref) async {
  final verticalIds = await ref.watch(currentUserVerticalIdsProvider.future);
  if (verticalIds.length <= 1) return null;

  final selected = ref.watch(selectedFacilityVerticalIdProvider);
  if (selected != null && verticalIds.contains(selected)) {
    return selected;
  }
  return null;
});

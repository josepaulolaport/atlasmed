import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  ref.watch(sessionProvider);
  return DashboardRepository();
});

/// Dashboard always uses exactly one vertical (no "Todas").
/// Auto-selects the first assigned vertical when unset / invalid.
final dashboardSelectedVerticalIdProvider = StateProvider<String?>(
  (ref) => null,
);

final dashboardEffectiveVerticalIdProvider = FutureProvider<String?>((
  ref,
) async {
  final options = await ref.watch(
    currentUserFacilityVerticalOptionsProvider.future,
  );
  if (options.isEmpty) return null;

  final selected = ref.watch(dashboardSelectedVerticalIdProvider);
  if (selected != null && options.any((v) => v.id == selected)) {
    return selected;
  }

  final first = options.first.id;
  // Seed selection so the chip row highlights correctly when multi-vertical.
  Future.microtask(() {
    ref.read(dashboardSelectedVerticalIdProvider.notifier).state = first;
  });
  return first;
});

final dashboardVerticalOptionsProvider = FutureProvider<List<BusinessVertical>>(
  (ref) {
    return ref.watch(currentUserFacilityVerticalOptionsProvider.future);
  },
);

final dashboardSummaryProvider = FutureProvider<DashboardSummary?>((ref) async {
  ref.watch(sessionProvider);
  final verticalId = await ref.watch(
    dashboardEffectiveVerticalIdProvider.future,
  );
  if (verticalId == null) return null;
  return ref
      .watch(dashboardRepositoryProvider)
      .fetchSummary(verticalId: verticalId);
});

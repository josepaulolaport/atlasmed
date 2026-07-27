import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Repository provider — each [verticalId] gets its own repository instance.
/// Caches are isolated per vertical; `.autoDispose` discards the repository
/// when the vertical is no longer watched (e.g. after a switch).
final dashboardRepositoryProvider = Provider.autoDispose
    .family<DashboardRepository, String>((ref, verticalId) {
      return DashboardRepository(verticalId: verticalId);
    });

/// Currently selected vertical. `null` means "not yet resolved".
final dashboardSelectedVerticalIdProvider = StateProvider<String?>(
  (ref) => null,
);

/// All business verticals the user can access (for the chip selector).
final dashboardVerticalOptionsProvider = FutureProvider<List<BusinessVertical>>(
  (ref) {
    return ref.watch(currentUserFacilityVerticalOptionsProvider.future);
  },
);

import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Optional Linha filter. `null` = all assigned (backend scopes via token).
final dashboardSelectedVerticalIdProvider = StateProvider<int?>(
  (ref) => null,
);

/// Repository keyed by optional filter (`null` / empty = union).
final dashboardRepositoryProvider = Provider.autoDispose
    .family<DashboardRepository, int?>((ref, verticalId) {
      final repo = DashboardRepository(verticalId: verticalId);
      ref.onDispose(repo.dispose);
      return repo;
    });

/// Vertical options for the chip selector (only shown when 2+).
final dashboardVerticalOptionsProvider = FutureProvider<List<BusinessVertical>>(
  (ref) {
    return ref.watch(currentUserFacilityVerticalOptionsProvider.future);
  },
);

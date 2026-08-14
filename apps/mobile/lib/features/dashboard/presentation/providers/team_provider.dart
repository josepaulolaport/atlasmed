import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/member_territory_map.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TeamArgs {
  const TeamArgs({
    required this.verticalId,
    this.managerId,
    this.sortBy = 'name',
    this.order = 'asc',
  });

  final int verticalId;

  /// ADMIN only: drill into one manager's team.
  final int? managerId;

  /// Only the order. Every row carries its figures whatever the sort is, and
  /// the two sorts that are not row metrics — penetração, sem representante —
  /// are the only ones the API computes per member (spec 0014 §6).
  final String sortBy;
  final String order;

  TeamArgs copyWith({String? sortBy, String? order, int? managerId}) =>
      TeamArgs(
        verticalId: verticalId,
        managerId: managerId ?? this.managerId,
        sortBy: sortBy ?? this.sortBy,
        order: order ?? this.order,
      );

  @override
  bool operator ==(Object other) =>
      other is TeamArgs &&
      other.verticalId == verticalId &&
      other.managerId == managerId &&
      other.sortBy == sortBy &&
      other.order == order;

  @override
  int get hashCode => Object.hash(verticalId, managerId, sortBy, order);
}

final teamProvider = Provider.autoDispose
    .family<Repository<List<TeamMember>>, TeamArgs>((ref, args) {
      final repository = teamRepository(
        verticalId: args.verticalId,
        managerId: args.managerId,
        sortBy: args.sortBy,
        order: args.order,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

/// One member's profile, keyed by (linha, pessoa).
class TeamMemberArgs {
  const TeamMemberArgs({required this.verticalId, required this.userId});

  final int verticalId;
  final int userId;

  @override
  bool operator ==(Object other) =>
      other is TeamMemberArgs &&
      other.verticalId == verticalId &&
      other.userId == userId;

  @override
  int get hashCode => Object.hash(verticalId, userId);
}

final teamMemberProvider = Provider.autoDispose
    .family<Repository<TeamMemberProfile>, TeamMemberArgs>((ref, args) {
      final repository = teamMemberRepository(
        verticalId: args.verticalId,
        userId: args.userId,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

final repsWithoutPatchProvider =
    Provider.autoDispose<Repository<List<TeamMember>>>((ref) {
      final repository = RepsWithoutPatchRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });

/// A member's territory map, keyed by who is looking through whose team.
class MemberTerritoryArgs {
  const MemberTerritoryArgs({
    required this.verticalId,
    required this.userId,
    this.viaManagerId,
  });

  final int verticalId;
  final int userId;
  final int? viaManagerId;

  @override
  bool operator ==(Object other) =>
      other is MemberTerritoryArgs &&
      other.verticalId == verticalId &&
      other.userId == userId &&
      other.viaManagerId == viaManagerId;

  @override
  int get hashCode => Object.hash(verticalId, userId, viaManagerId);
}

final memberTerritoryProvider = Provider.autoDispose
    .family<Repository<MemberTerritoryMap>, MemberTerritoryArgs>((ref, args) {
      final repository = memberTerritoryRepository(
        verticalId: args.verticalId,
        userId: args.userId,
        viaManagerId: args.viaManagerId,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

/// Everything that derives from an assignment or a boundary (spec 0015 R13).
///
/// A clinic changing hands, or a polygon moving, changes the roster row, the
/// member profile's counts, the map, every clinic list and every Desempenho
/// card at once — they are all readings of the same two tables. Refreshing only
/// the screen you happen to be looking at leaves the others stating figures
/// that were true a moment ago, which is the failure mode spec 0014 §8.4
/// already recorded once with a cached scope.
///
/// Invalidating a family invalidates all of its instances, which is what makes
/// this correct rather than a list of the keys someone remembered: a rep's
/// profile, their manager's roster row and the admin's drill-down are three
/// different keys onto the same fact.
void invalidateAssignmentDerivedData(WidgetRef ref) {
  ref.invalidate(teamProvider);
  ref.invalidate(teamMemberProvider);
  ref.invalidate(memberTerritoryProvider);
  ref.invalidate(repsWithoutPatchProvider);
  ref.invalidate(metricClinicsProvider);
  ref.invalidate(assignedClinicsMetricProvider);
  ref.invalidate(unassignedClinicsMetricProvider);
  ref.invalidate(coverageMetricProvider);
  ref.invalidate(cadastroCompletionMetricProvider);
  ref.invalidate(purchaseBucketsMetricProvider);
  ref.invalidate(dashboardTerritoryProvider);
}

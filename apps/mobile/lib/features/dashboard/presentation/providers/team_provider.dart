import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
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

  /// Sorting by anything but `name` turns the roster into a leaderboard — the
  /// API then computes that one metric per member (spec 0014 §6).
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

final repsWithoutPatchProvider =
    Provider.autoDispose<Repository<List<TeamMember>>>((ref) {
      final repository = RepsWithoutPatchRepository();
      ref.onDispose(repository.dispose);
      return repository;
    });

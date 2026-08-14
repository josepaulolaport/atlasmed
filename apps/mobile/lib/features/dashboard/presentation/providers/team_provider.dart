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

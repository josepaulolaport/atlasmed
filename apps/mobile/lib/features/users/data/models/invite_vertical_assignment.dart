import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:equatable/equatable.dart';

/// Per-vertical slice of an invite payload — manager (REP only) and one or
/// more territories, all scoped to the same [verticalId].
class InviteVerticalAssignment extends Equatable {
  const InviteVerticalAssignment({
    required this.verticalId,
    required this.verticalName,
    this.managerId,
    this.managerName,
    this.territories = const [],
  });

  final String verticalId;
  final String verticalName;
  final String? managerId;
  final String? managerName;
  final List<TerritoryOption> territories;

  List<String> get territoryIds =>
      territories.map((t) => t.id).toList(growable: false);

  InviteVerticalAssignment copyWith({
    String? managerId,
    String? managerName,
    List<TerritoryOption>? territories,
    bool clearManager = false,
  }) {
    return InviteVerticalAssignment(
      verticalId: verticalId,
      verticalName: verticalName,
      managerId: clearManager ? null : (managerId ?? this.managerId),
      managerName: clearManager ? null : (managerName ?? this.managerName),
      territories: territories ?? this.territories,
    );
  }

  @override
  List<Object?> get props => [
    verticalId,
    verticalName,
    managerId,
    managerName,
    territories,
  ];
}

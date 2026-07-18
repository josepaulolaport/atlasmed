import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:equatable/equatable.dart';

/// Per-sector slice of an invite payload — manager (REP only) and one or
/// more territories, all scoped to the same [sectorId].
class InviteSectorAssignment extends Equatable {
  const InviteSectorAssignment({
    required this.sectorId,
    required this.sectorName,
    this.managerId,
    this.managerName,
    this.territories = const [],
  });

  final String sectorId;
  final String sectorName;
  final String? managerId;
  final String? managerName;
  final List<TerritoryOption> territories;

  List<String> get territoryIds =>
      territories.map((t) => t.id).toList(growable: false);

  InviteSectorAssignment copyWith({
    String? managerId,
    String? managerName,
    List<TerritoryOption>? territories,
    bool clearManager = false,
  }) {
    return InviteSectorAssignment(
      sectorId: sectorId,
      sectorName: sectorName,
      managerId: clearManager ? null : (managerId ?? this.managerId),
      managerName: clearManager ? null : (managerName ?? this.managerName),
      territories: territories ?? this.territories,
    );
  }

  @override
  List<Object?> get props => [
    sectorId,
    sectorName,
    managerId,
    managerName,
    territories,
  ];
}

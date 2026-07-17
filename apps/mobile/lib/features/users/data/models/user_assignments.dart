import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:equatable/equatable.dart';

/// A single territory assignment row, as returned by
/// `GET /access/users/:id/assignments`.
///
/// `sectorId`/`sectorName`/`centroid`/`boundary` are optional — today's
/// real endpoint only returns `{territoryId, assignedAt}` (see
/// `get-user-assignments.use-case.ts`); these extra fields are populated by
/// the mock repository so the assigned-territories map cards have
/// something to render ahead of the backend growing richer assignment DTOs.
class TerritoryAssignment extends Equatable {
  const TerritoryAssignment({
    required this.territoryId,
    required this.territoryName,
    required this.assignedAt,
    this.sectorId,
    this.sectorName,
    this.centroid,
    this.boundary,
  });

  final String territoryId;
  final String territoryName;
  final DateTime assignedAt;
  final String? sectorId;
  final String? sectorName;
  final MapCoordinate? centroid;
  final TerritoryGeometry? boundary;

  factory TerritoryAssignment.fromJson(Map<String, dynamic> json) =>
      TerritoryAssignment(
        territoryId: json['territoryId'] as String,
        territoryName: (json['territoryName'] as String?) ?? '—',
        assignedAt: DateTime.parse(json['assignedAt'] as String),
        sectorId: json['sectorId'] as String?,
        sectorName: json['sectorName'] as String?,
        centroid: json['centroid'] == null
            ? null
            : MapCoordinate(
                longitude: (json['centroid']['longitude'] as num).toDouble(),
                latitude: (json['centroid']['latitude'] as num).toDouble(),
              ),
        boundary: json['boundary'] == null
            ? null
            : TerritoryGeometry.fromGeoJson(
                json['boundary'] as Map<String, dynamic>,
              ),
      );

  @override
  List<Object?> get props => [
    territoryId,
    territoryName,
    assignedAt,
    sectorId,
    sectorName,
    centroid,
    boundary,
  ];
}

/// A single sector assignment row, as returned by
/// `GET /access/users/:id/assignments`.
class SectorAssignment extends Equatable {
  const SectorAssignment({
    required this.sectorId,
    required this.sectorName,
    required this.assignedAt,
  });

  final String sectorId;
  final String sectorName;
  final DateTime assignedAt;

  factory SectorAssignment.fromJson(Map<String, dynamic> json) =>
      SectorAssignment(
        sectorId: json['sectorId'] as String,
        sectorName: (json['sectorName'] as String?) ?? '—',
        assignedAt: DateTime.parse(json['assignedAt'] as String),
      );

  @override
  List<Object?> get props => [sectorId, sectorName, assignedAt];
}

/// Mirrors `get-user-assignments.use-case.ts`'s response shape
/// (`GET /access/users/:id/assignments` once that admin route exists —
/// today only the self-service `GET /user/assignments` is mounted).
class UserAssignments extends Equatable {
  const UserAssignments({
    required this.userId,
    this.managerId,
    this.managerName,
    required this.territories,
    required this.sectors,
    required this.isOperationallyActive,
  });

  final String userId;
  final String? managerId;
  final String? managerName;
  final List<TerritoryAssignment> territories;
  final List<SectorAssignment> sectors;

  /// REP with at least one territory assigned.
  final bool isOperationallyActive;

  factory UserAssignments.fromJson(Map<String, dynamic> json) =>
      UserAssignments(
        userId: json['userId'] as String,
        managerId: json['managerId'] as String?,
        managerName: json['managerName'] as String?,
        territories:
            (json['territories'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>()
                .map(TerritoryAssignment.fromJson)
                .toList() ??
            const [],
        sectors:
            (json['sectors'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>()
                .map(SectorAssignment.fromJson)
                .toList() ??
            const [],
        isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
      );

  UserAssignments copyWith({
    String? managerId,
    String? managerName,
    bool clearManager = false,
    List<TerritoryAssignment>? territories,
    List<SectorAssignment>? sectors,
    bool? isOperationallyActive,
  }) {
    return UserAssignments(
      userId: userId,
      managerId: clearManager ? null : (managerId ?? this.managerId),
      managerName: clearManager ? null : (managerName ?? this.managerName),
      territories: territories ?? this.territories,
      sectors: sectors ?? this.sectors,
      isOperationallyActive:
          isOperationallyActive ?? this.isOperationallyActive,
    );
  }

  @override
  List<Object?> get props => [
    userId,
    managerId,
    managerName,
    territories,
    sectors,
    isOperationallyActive,
  ];
}

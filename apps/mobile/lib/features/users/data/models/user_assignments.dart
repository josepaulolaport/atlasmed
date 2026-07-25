import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:equatable/equatable.dart';

/// A single territory assignment row — used by map cards and legacy list UIs.
///
/// Prefer [UserAssignments.verticalAssignments] (invite-shaped) as the source
/// of truth; [TerritoryAssignment] is derived for rendering.
class TerritoryAssignment extends Equatable {
  const TerritoryAssignment({
    required this.territoryId,
    required this.territoryName,
    required this.assignedAt,
    this.verticalId,
    this.verticalName,
    this.centroid,
    this.boundary,
  });

  final String territoryId;
  final String territoryName;
  final DateTime assignedAt;
  final String? verticalId;
  final String? verticalName;
  final MapCoordinate? centroid;
  final TerritoryGeometry? boundary;

  factory TerritoryAssignment.fromOption(
    TerritoryOption option, {
    DateTime? assignedAt,
  }) {
    return TerritoryAssignment(
      territoryId: option.id,
      territoryName: option.name,
      assignedAt: assignedAt ?? DateTime.now(),
      verticalId: option.verticalId,
      verticalName: option.verticalName,
      centroid: option.centroid,
      boundary: option.boundary,
    );
  }

  factory TerritoryAssignment.fromJson(Map<String, dynamic> json) =>
      TerritoryAssignment(
        territoryId: json['territoryId'] as String,
        territoryName: (json['territoryName'] as String?) ?? '—',
        assignedAt: DateTime.parse(json['assignedAt'] as String),
        verticalId: json['verticalId'] as String?,
        verticalName: json['verticalName'] as String?,
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
    verticalId,
    verticalName,
    centroid,
    boundary,
  ];
}

/// A single sector assignment row (legacy flat list shape).
class VerticalAssignment extends Equatable {
  const VerticalAssignment({
    required this.verticalId,
    required this.verticalName,
    required this.assignedAt,
  });

  final String verticalId;
  final String verticalName;
  final DateTime assignedAt;

  factory VerticalAssignment.fromJson(Map<String, dynamic> json) =>
      VerticalAssignment(
        verticalId: json['verticalId'] as String,
        verticalName: (json['verticalName'] as String?) ?? '—',
        assignedAt: DateTime.parse(json['assignedAt'] as String),
      );

  @override
  List<Object?> get props => [verticalId, verticalName, assignedAt];
}

/// Admin assignments for a user — same per-sector shape as the invite flow
/// ([InviteVerticalAssignment]: manager + territories scoped to a sector).
class UserAssignments extends Equatable {
  const UserAssignments({
    required this.userId,
    this.verticalAssignments = const [],
    required this.isOperationallyActive,
  });

  final String userId;

  /// Per-sector manager + territory picks (invite-compatible).
  final List<InviteVerticalAssignment> verticalAssignments;

  /// REP with at least one territory assigned.
  final bool isOperationallyActive;

  /// First manager found across sectors (summary for list/tests).
  String? get managerId {
    for (final assignment in verticalAssignments) {
      if (assignment.managerId != null) return assignment.managerId;
    }
    return null;
  }

  String? get managerName {
    for (final assignment in verticalAssignments) {
      if (assignment.managerName != null) return assignment.managerName;
    }
    return null;
  }

  List<TerritoryAssignment> get territories {
    final now = DateTime.now();
    return verticalAssignments
        .expand(
          (assignment) => assignment.territories.map(
            (territory) =>
                TerritoryAssignment.fromOption(territory, assignedAt: now),
          ),
        )
        .toList(growable: false);
  }

  List<VerticalAssignment> get sectors {
    final now = DateTime.now();
    return verticalAssignments
        .map(
          (assignment) => VerticalAssignment(
            verticalId: assignment.verticalId,
            verticalName: assignment.verticalName,
            assignedAt: now,
          ),
        )
        .toList(growable: false);
  }

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    final sectorRaw = json['verticalAssignments'] as List<dynamic>?;
    if (sectorRaw != null) {
      final verticalAssignments = sectorRaw.map((raw) {
        final map = raw as Map<String, dynamic>;
        return InviteVerticalAssignment(
          verticalId: map['verticalId'] as String,
          verticalName: map['verticalName'] as String,
          managerId: map['managerId'] as String?,
          managerName: map['managerName'] as String?,
          territories: (map['territories'] as List<dynamic>? ?? const [])
              .map((t) => TerritoryOption.fromJson(t as Map<String, dynamic>))
              .toList(),
        );
      }).toList();
      return UserAssignments(
        userId: json['userId'] as String,
        verticalAssignments: verticalAssignments,
        isOperationallyActive:
            json['isOperationallyActive'] as bool? ??
            verticalAssignments.any((a) => a.territories.isNotEmpty),
      );
    }

    // Legacy flat shape → group by sector.
    final territories =
        (json['territories'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>()
            .map(TerritoryAssignment.fromJson)
            .toList() ??
        const <TerritoryAssignment>[];
    final sectors =
        (json['verticals'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>()
            .map(VerticalAssignment.fromJson)
            .toList() ??
        const <VerticalAssignment>[];
    final managerId = json['managerId'] as String?;
    final managerName = json['managerName'] as String?;

    final bySector = <String, InviteVerticalAssignment>{};
    for (final sector in sectors) {
      bySector[sector.verticalId] = InviteVerticalAssignment(
        verticalId: sector.verticalId,
        verticalName: sector.verticalName,
        managerId: managerId,
        managerName: managerName,
      );
    }
    for (final territory in territories) {
      final verticalId = territory.verticalId ?? 'sector-unknown';
      final existing = bySector[verticalId];
      final option = TerritoryOption(
        id: territory.territoryId,
        name: territory.territoryName,
        verticalId: territory.verticalId,
        verticalName: territory.verticalName,
        centroid: territory.centroid,
        boundary: territory.boundary,
      );
      if (existing == null) {
        bySector[verticalId] = InviteVerticalAssignment(
          verticalId: verticalId,
          verticalName: territory.verticalName ?? '—',
          managerId: managerId,
          managerName: managerName,
          territories: [option],
        );
      } else {
        bySector[verticalId] = existing.copyWith(
          territories: [...existing.territories, option],
        );
      }
    }

    return UserAssignments(
      userId: json['userId'] as String,
      verticalAssignments: bySector.values.toList(growable: false),
      isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
    );
  }

  UserAssignments copyWith({
    List<InviteVerticalAssignment>? verticalAssignments,
    bool? isOperationallyActive,
  }) {
    return UserAssignments(
      userId: userId,
      verticalAssignments: verticalAssignments ?? this.verticalAssignments,
      isOperationallyActive:
          isOperationallyActive ?? this.isOperationallyActive,
    );
  }

  @override
  List<Object?> get props => [
    userId,
    verticalAssignments,
    isOperationallyActive,
  ];
}

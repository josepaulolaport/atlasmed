import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
import 'package:equatable/equatable.dart';

/// A single territory assignment row — used by map cards and legacy list UIs.
///
/// Prefer [UserAssignments.sectorAssignments] (invite-shaped) as the source
/// of truth; [TerritoryAssignment] is derived for rendering.
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

  factory TerritoryAssignment.fromOption(
    TerritoryOption option, {
    DateTime? assignedAt,
  }) {
    return TerritoryAssignment(
      territoryId: option.id,
      territoryName: option.name,
      assignedAt: assignedAt ?? DateTime.now(),
      sectorId: option.sectorId,
      sectorName: option.sectorName,
      centroid: option.centroid,
      boundary: option.boundary,
    );
  }

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

/// A single sector assignment row (legacy flat list shape).
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

/// Admin assignments for a user — same per-sector shape as the invite flow
/// ([InviteSectorAssignment]: manager + territories scoped to a sector).
class UserAssignments extends Equatable {
  const UserAssignments({
    required this.userId,
    this.sectorAssignments = const [],
    required this.isOperationallyActive,
  });

  final String userId;

  /// Per-sector manager + territory picks (invite-compatible).
  final List<InviteSectorAssignment> sectorAssignments;

  /// REP with at least one territory assigned.
  final bool isOperationallyActive;

  /// First manager found across sectors (summary for list/tests).
  String? get managerId {
    for (final assignment in sectorAssignments) {
      if (assignment.managerId != null) return assignment.managerId;
    }
    return null;
  }

  String? get managerName {
    for (final assignment in sectorAssignments) {
      if (assignment.managerName != null) return assignment.managerName;
    }
    return null;
  }

  List<TerritoryAssignment> get territories {
    final now = DateTime.now();
    return sectorAssignments
        .expand(
          (assignment) => assignment.territories.map(
            (territory) => TerritoryAssignment.fromOption(
              territory,
              assignedAt: now,
            ),
          ),
        )
        .toList(growable: false);
  }

  List<SectorAssignment> get sectors {
    final now = DateTime.now();
    return sectorAssignments
        .map(
          (assignment) => SectorAssignment(
            sectorId: assignment.sectorId,
            sectorName: assignment.sectorName,
            assignedAt: now,
          ),
        )
        .toList(growable: false);
  }

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    final sectorRaw = json['sectorAssignments'] as List<dynamic>?;
    if (sectorRaw != null) {
      final sectorAssignments = sectorRaw.map((raw) {
        final map = raw as Map<String, dynamic>;
        return InviteSectorAssignment(
          sectorId: map['sectorId'] as String,
          sectorName: map['sectorName'] as String,
          managerId: map['managerId'] as String?,
          managerName: map['managerName'] as String?,
          territories: (map['territories'] as List<dynamic>? ?? const [])
              .map((t) => TerritoryOption.fromJson(t as Map<String, dynamic>))
              .toList(),
        );
      }).toList();
      return UserAssignments(
        userId: json['userId'] as String,
        sectorAssignments: sectorAssignments,
        isOperationallyActive:
            json['isOperationallyActive'] as bool? ??
            sectorAssignments.any((a) => a.territories.isNotEmpty),
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
        (json['sectors'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>()
            .map(SectorAssignment.fromJson)
            .toList() ??
        const <SectorAssignment>[];
    final managerId = json['managerId'] as String?;
    final managerName = json['managerName'] as String?;

    final bySector = <String, InviteSectorAssignment>{};
    for (final sector in sectors) {
      bySector[sector.sectorId] = InviteSectorAssignment(
        sectorId: sector.sectorId,
        sectorName: sector.sectorName,
        managerId: managerId,
        managerName: managerName,
      );
    }
    for (final territory in territories) {
      final sectorId = territory.sectorId ?? 'sector-unknown';
      final existing = bySector[sectorId];
      final option = TerritoryOption(
        id: territory.territoryId,
        name: territory.territoryName,
        sectorId: territory.sectorId,
        sectorName: territory.sectorName,
        centroid: territory.centroid,
        boundary: territory.boundary,
      );
      if (existing == null) {
        bySector[sectorId] = InviteSectorAssignment(
          sectorId: sectorId,
          sectorName: territory.sectorName ?? '—',
          managerId: managerId,
          managerName: managerName,
          territories: [option],
        );
      } else {
        bySector[sectorId] = existing.copyWith(
          territories: [...existing.territories, option],
        );
      }
    }

    return UserAssignments(
      userId: json['userId'] as String,
      sectorAssignments: bySector.values.toList(growable: false),
      isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
    );
  }

  UserAssignments copyWith({
    List<InviteSectorAssignment>? sectorAssignments,
    bool? isOperationallyActive,
  }) {
    return UserAssignments(
      userId: userId,
      sectorAssignments: sectorAssignments ?? this.sectorAssignments,
      isOperationallyActive:
          isOperationallyActive ?? this.isOperationallyActive,
    );
  }

  @override
  List<Object?> get props => [userId, sectorAssignments, isOperationallyActive];
}

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:equatable/equatable.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

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

  final int territoryId;
  final String territoryName;
  final DateTime assignedAt;
  final int? verticalId;
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
        territoryId: readCrmId(json['territoryId'], 'territoryId'),
        territoryName: (json['territoryName'] as String?) ?? '—',
        assignedAt: DateTime.parse(json['assignedAt'] as String),
        verticalId: readCrmIdOrNull(json['verticalId'], 'verticalId'),
        verticalName: json['verticalName'] as String?,
        centroid: json['centroid'] == null
            ? null
            : MapCoordinate(
                longitude: (json['centroid']['longitude'] as num).toDouble(),
                latitude: (json['centroid']['latitude'] as num).toDouble(),
              ),
        boundary: json['boundary'] == null
            ? null
            : TerritoryGeometry.tryFromGeoJson(
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

  final int verticalId;
  final String verticalName;
  final DateTime assignedAt;

  factory VerticalAssignment.fromJson(Map<String, dynamic> json) =>
      VerticalAssignment(
        verticalId: readCrmId(json['verticalId'], 'verticalId'),
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

  final int userId;

  /// Per-sector manager + territory picks (invite-compatible).
  final List<InviteVerticalAssignment> verticalAssignments;

  /// REP with at least one territory assigned.
  final bool isOperationallyActive;

  /// Distinct managers across verticals (territory-derived; multi-manager OK).
  List<AssignmentManagerRef> get managers {
    final byId = <int, AssignmentManagerRef>{};
    for (final assignment in verticalAssignments) {
      for (final manager in assignment.managers) {
        byId[manager.id] = manager;
      }
    }
    return byId.values.toList(growable: false);
  }

  /// Joined manager names for compact labels.
  String? get managerName {
    final all = managers;
    if (all.isNotEmpty) {
      return all.map((m) => m.name).join(', ');
    }
    for (final assignment in verticalAssignments) {
      final name = assignment.managerName;
      if (name != null && name.isNotEmpty) return name;
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
        final managersRaw = map['managers'] as List<dynamic>?;
        final managers = <AssignmentManagerRef>[
          if (managersRaw != null)
            ...managersRaw.map(
              (item) =>
                  AssignmentManagerRef.fromJson(item as Map<String, dynamic>),
            ),
        ];
        final managerDisplayName =
            map['managerName'] as String? ??
            (managers.isEmpty ? null : managers.map((m) => m.name).join(', '));
        // Compat: single managerName without managers[].
        if (managers.isEmpty &&
            managerDisplayName != null &&
            managerDisplayName.isNotEmpty) {
          final managerId = readCrmIdOrNull(map['managerId'], 'managerId');
          if (managerId != null) {
            managers.add(
              AssignmentManagerRef(id: managerId, name: managerDisplayName),
            );
          }
        }
        return InviteVerticalAssignment(
          verticalId: readCrmId(map['verticalId'], 'verticalId'),
          verticalName: map['verticalName'] as String? ?? '—',
          managerZoneId: readCrmIdOrNull(map['managerZoneId'], 'managerZoneId'),
          managerZoneName: map['managerZoneName'] as String?,
          managerDisplayName: managerDisplayName,
          managers: managers,
          territories: (map['territories'] as List<dynamic>? ?? const [])
              .map((t) => TerritoryOption.fromJson(t as Map<String, dynamic>))
              .toList(),
        );
      }).toList();
      return UserAssignments(
        userId: readCrmId(json['userId'], 'userId'),
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
    final managerName = json['managerName'] as String?;
    final managerId = readCrmIdOrNull(json['managerId'], 'managerId');
    final managers = managerName != null &&
            managerName.isNotEmpty &&
            managerId != null
        ? [AssignmentManagerRef(id: managerId, name: managerName)]
        : const <AssignmentManagerRef>[];

    final bySector = <int, InviteVerticalAssignment>{};
    for (final sector in sectors) {
      bySector[sector.verticalId] = InviteVerticalAssignment(
        verticalId: sector.verticalId,
        verticalName: sector.verticalName,
        managerDisplayName: managerName,
        managers: managers,
      );
    }
    for (final territory in territories) {
      final verticalId = territory.verticalId;
      if (verticalId == null) continue;
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
          managerDisplayName: managerName,
          managers: managers,
          territories: [option],
        );
      } else {
        bySector[verticalId] = existing.copyWith(
          territories: [...existing.territories, option],
        );
      }
    }

    return UserAssignments(
      userId: readCrmId(json['userId'], 'userId'),
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

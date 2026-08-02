import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:equatable/equatable.dart';

/// Territory-derived manager for a vertical (zone UTA).
class AssignmentManagerRef extends Equatable {
  const AssignmentManagerRef({required this.id, required this.name});

  final String id;
  final String name;

  factory AssignmentManagerRef.fromJson(Map<String, dynamic> json) {
    return AssignmentManagerRef(
      id: json['id'] as String,
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? json['name'] as String
          : (json['username'] as String? ?? json['id'] as String),
    );
  }

  @override
  List<Object?> get props => [id, name];
}

/// Client-side draft for invite `newPatch` (created on submit, not on draw).
class InviteNewPatchDraft extends Equatable {
  const InviteNewPatchDraft({
    required this.name,
    required this.managerZoneId,
    required this.boundary,
    this.centroid,
    this.geometry,
  });

  final String name;
  final String managerZoneId;
  final Map<String, dynamic> boundary;
  final MapCoordinate? centroid;
  final TerritoryGeometry? geometry;

  Map<String, dynamic> toJson() => {
        'name': name,
        'managerZoneId': managerZoneId,
        'boundary': boundary,
      };

  @override
  List<Object?> get props => [name, managerZoneId, boundary, centroid, geometry];
}

/// Per-vertical slice of an invite payload — zone/patch territories only.
/// Manager link is territory-derived (zone UTA), not a boss FK.
class InviteVerticalAssignment extends Equatable {
  const InviteVerticalAssignment({
    required this.verticalId,
    required this.verticalName,
    this.managerZoneId,
    this.managerZoneName,
    this.managerDisplayName,
    this.managers = const [],
    this.territories = const [],
    this.newPatch,
  });

  final String verticalId;
  final String verticalName;

  /// Selected manager zone for REP invite (parent of patches).
  final String? managerZoneId;
  final String? managerZoneName;

  /// Display-only summary (joined names). Prefer [managers] when present.
  final String? managerDisplayName;

  /// Distinct territory-derived managers for this vertical (multi-manager OK).
  final List<AssignmentManagerRef> managers;

  /// MANAGER: zones. REP: empty patches under [managerZoneId].
  /// Mutually exclusive with [newPatch] (API XOR).
  final List<TerritoryOption> territories;

  /// Draft patch to create on invite submit (REP only).
  final InviteNewPatchDraft? newPatch;

  List<String> get territoryIds =>
      territories.map((t) => t.id).toList(growable: false);

  bool get hasTerritorySelection =>
      territories.isNotEmpty || newPatch != null;

  /// Compat / UI label — joined manager names.
  String? get managerName {
    if (managers.isNotEmpty) {
      return managers.map((m) => m.name).join(', ');
    }
    return managerDisplayName;
  }

  InviteVerticalAssignment copyWith({
    String? managerZoneId,
    String? managerZoneName,
    String? managerDisplayName,
    List<AssignmentManagerRef>? managers,
    List<TerritoryOption>? territories,
    InviteNewPatchDraft? newPatch,
    bool clearZone = false,
    bool clearNewPatch = false,
  }) {
    return InviteVerticalAssignment(
      verticalId: verticalId,
      verticalName: verticalName,
      managerZoneId: clearZone ? null : (managerZoneId ?? this.managerZoneId),
      managerZoneName:
          clearZone ? null : (managerZoneName ?? this.managerZoneName),
      managerDisplayName: clearZone
          ? null
          : (managers != null && managers.isEmpty
              ? null
              : (managerDisplayName ?? this.managerDisplayName)),
      managers: clearZone ? const [] : (managers ?? this.managers),
      territories: territories ?? this.territories,
      newPatch: clearNewPatch || clearZone
          ? null
          : (newPatch ?? this.newPatch),
    );
  }

  @override
  List<Object?> get props => [
        verticalId,
        verticalName,
        managerZoneId,
        managerZoneName,
        managerDisplayName,
        managers,
        territories,
        newPatch,
      ];
}

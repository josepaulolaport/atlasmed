import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:equatable/equatable.dart';

class AssignmentManager extends Equatable {
  const AssignmentManager({
    required this.id,
    required this.name,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
  });

  final int id;
  final String name;
  final String? username;
  final String? email;
  final String? firstName;
  final String? lastName;

  String get displayName {
    final composed = [firstName, lastName]
        .whereType<String>()
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .join(' ');
    if (composed.isNotEmpty) return composed;
    if (name.trim().isNotEmpty) return name;
    return username ?? id.toString();
  }

  factory AssignmentManager.fromJson(Map<String, dynamic> json) {
    final firstName = json['firstName'] as String?;
    final lastName = json['lastName'] as String?;
    final username = json['username'] as String?;
    final composed = [firstName, lastName]
        .whereType<String>()
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .join(' ');
    return AssignmentManager(
      id: readCrmId(json['id'], 'id'),
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? json['name'] as String
          : (composed.isNotEmpty
                ? composed
                : (username ?? readCrmId(json['id'], 'id').toString())),
      username: username,
      email: json['email'] as String?,
      firstName: firstName,
      lastName: lastName,
    );
  }

  @override
  List<Object?> get props => [id, name, username, email, firstName, lastName];
}

class UserTerritoryAssignment extends Equatable {
  const UserTerritoryAssignment({
    required this.territoryId,
    required this.territoryName,
    this.managerZoneId,
    this.managerZoneName,
    this.boundary,
  });

  final int territoryId;
  final String territoryName;
  final int? managerZoneId;
  final String? managerZoneName;
  final Map<String, dynamic>? boundary;

  factory UserTerritoryAssignment.fromJson(Map<String, dynamic> json) {
    return UserTerritoryAssignment(
      territoryId:
          readCrmIdOrNull(json['id'], 'id') ??
          readCrmId(json['territoryId'], 'territoryId'),
      territoryName: (json['name'] as String?) ?? '—',
      managerZoneId: readCrmIdOrNull(json['managerZoneId'], 'managerZoneId'),
      managerZoneName: json['managerZoneName'] as String?,
      boundary: json['boundary'] as Map<String, dynamic>?,
    );
  }

  @override
  List<Object?> get props => [
    territoryId,
    territoryName,
    managerZoneId,
    managerZoneName,
    boundary,
  ];
}

class UserVerticalAssignment extends Equatable {
  const UserVerticalAssignment({
    required this.verticalId,
    required this.verticalName,
    this.managers = const [],
    this.managerId,
    this.managerName,
    this.territories = const [],
    this.assignedAt,
  });

  final int verticalId;
  final String verticalName;

  /// Territory-derived managers for this vertical (may be multiple).
  final List<AssignmentManager> managers;

  @Deprecated('Use managers')
  final int? managerId;
  final String? managerName;
  final List<UserTerritoryAssignment> territories;
  final DateTime? assignedAt;

  factory UserVerticalAssignment.fromJson(Map<String, dynamic> json) {
    final managersRaw = json['managers'] as List<dynamic>?;
    final managers = managersRaw != null
        ? managersRaw
              .map(
                (item) =>
                    AssignmentManager.fromJson(item as Map<String, dynamic>),
              )
              .toList()
        : <AssignmentManager>[];

    // Compat: single managerName / managerId from older payloads.
    if (managers.isEmpty && json['managerName'] is String) {
      final id = readCrmIdOrNull(json['managerId'], 'managerId');
      if (id != null || (json['managerName'] as String).isNotEmpty) {
        managers.add(
          AssignmentManager(id: id ?? 0, name: json['managerName'] as String),
        );
      }
    }

    return UserVerticalAssignment(
      verticalId: readCrmId(json['verticalId'], 'verticalId'),
      verticalName: (json['verticalName'] as String?) ?? '—',
      managers: managers,
      managerId: readCrmIdOrNull(json['managerId'], 'managerId'),
      managerName:
          json['managerName'] as String? ??
          (managers.isEmpty
              ? null
              : managers.map((m) => m.displayName).join(', ')),
      territories: (json['territories'] as List<dynamic>? ?? const [])
          .map(
            (item) =>
                UserTerritoryAssignment.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      assignedAt: json['assignedAt'] != null
          ? DateTime.tryParse(json['assignedAt'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props => [
    verticalId,
    verticalName,
    managers,
    managerId,
    managerName,
    territories,
    assignedAt,
  ];
}

/// Self-service assignments from `GET /user/assignments`.
class UserAssignments extends Equatable {
  const UserAssignments({
    required this.userId,
    required this.verticals,
    required this.isOperationallyActive,
  });

  final int userId;
  final List<UserVerticalAssignment> verticals;
  final bool isOperationallyActive;

  List<UserTerritoryAssignment> get territories => verticals
      .expand((vertical) => vertical.territories)
      .toList(growable: false);

  /// Distinct managers across all verticals (multi-manager REPs).
  List<AssignmentManager> get managers {
    final byId = <int, AssignmentManager>{};
    for (final vertical in verticals) {
      for (final manager in vertical.managers) {
        byId[manager.id] = manager;
      }
    }
    return byId.values.toList(growable: false);
  }

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    return UserAssignments(
      userId: readCrmId(json['userId'], 'userId'),
      verticals: (json['verticalAssignments'] as List<dynamic>? ?? const [])
          .map(
            (item) =>
                UserVerticalAssignment.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
    );
  }

  factory UserAssignments.fromRawJson(String json) {
    return UserAssignments.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  @override
  List<Object?> get props => [userId, verticals, isOperationallyActive];
}

import 'dart:convert';

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

  final String id;
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
    return username ?? id;
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
      id: json['id'] as String,
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? json['name'] as String
          : (composed.isNotEmpty ? composed : (username ?? json['id'] as String)),
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

  final String territoryId;
  final String territoryName;
  final String? managerZoneId;
  final String? managerZoneName;
  final Map<String, dynamic>? boundary;

  factory UserTerritoryAssignment.fromJson(Map<String, dynamic> json) {
    return UserTerritoryAssignment(
      territoryId: json['id'] as String? ?? json['territoryId'] as String,
      territoryName: (json['name'] as String?) ?? '—',
      managerZoneId: json['managerZoneId'] as String?,
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

  final String verticalId;
  final String verticalName;

  /// Territory-derived managers for this vertical (may be multiple).
  final List<AssignmentManager> managers;

  @Deprecated('Use managers')
  final String? managerId;
  final String? managerName;
  final List<UserTerritoryAssignment> territories;
  final DateTime? assignedAt;

  factory UserVerticalAssignment.fromJson(Map<String, dynamic> json) {
    final managersRaw = json['managers'] as List<dynamic>?;
    final managers = managersRaw != null
        ? managersRaw
            .map((item) => AssignmentManager.fromJson(item as Map<String, dynamic>))
            .toList()
        : <AssignmentManager>[];

    // Compat: single managerName / managerId from older payloads.
    if (managers.isEmpty && json['managerName'] is String) {
      final id = json['managerId'] as String?;
      if (id != null || (json['managerName'] as String).isNotEmpty) {
        managers.add(
          AssignmentManager(
            id: id ?? 'unknown',
            name: json['managerName'] as String,
          ),
        );
      }
    }

    return UserVerticalAssignment(
      verticalId: json['verticalId'] as String,
      verticalName: (json['verticalName'] as String?) ?? '—',
      managers: managers,
      managerId: json['managerId'] as String?,
      managerName: json['managerName'] as String? ??
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

  final String userId;
  final List<UserVerticalAssignment> verticals;
  final bool isOperationallyActive;

  List<UserTerritoryAssignment> get territories => verticals
      .expand((vertical) => vertical.territories)
      .toList(growable: false);

  /// Distinct managers across all verticals (multi-manager REPs).
  List<AssignmentManager> get managers {
    final byId = <String, AssignmentManager>{};
    for (final vertical in verticals) {
      for (final manager in vertical.managers) {
        byId[manager.id] = manager;
      }
    }
    return byId.values.toList(growable: false);
  }

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    final verticalRaw = json['verticalAssignments'] as List<dynamic>?;
    if (verticalRaw != null) {
      return UserAssignments(
        userId: json['userId'] as String,
        verticals: verticalRaw
            .map(
              (item) =>
                  UserVerticalAssignment.fromJson(item as Map<String, dynamic>),
            )
            .toList(),
        isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
      );
    }

    return UserAssignments(
      userId: json['userId'] as String,
      verticals: (json['verticals'] as List<dynamic>? ?? const [])
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

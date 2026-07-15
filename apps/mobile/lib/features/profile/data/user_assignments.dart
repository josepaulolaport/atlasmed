import 'dart:convert';

import 'package:equatable/equatable.dart';

class AssignmentManager extends Equatable {
  const AssignmentManager({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
  });

  final String id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;

  factory AssignmentManager.fromJson(Map<String, dynamic> json) {
    return AssignmentManager(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, username, email, firstName, lastName];
}

class UserTerritoryAssignment extends Equatable {
  const UserTerritoryAssignment({
    required this.territoryId,
    required this.assignedAt,
  });

  final String territoryId;
  final DateTime assignedAt;

  factory UserTerritoryAssignment.fromJson(Map<String, dynamic> json) {
    return UserTerritoryAssignment(
      territoryId: json['territoryId'] as String,
      assignedAt: DateTime.parse(json['assignedAt'] as String),
    );
  }

  @override
  List<Object?> get props => [territoryId, assignedAt];
}

class UserSectorAssignment extends Equatable {
  const UserSectorAssignment({
    required this.sectorId,
    required this.assignedAt,
  });

  final String sectorId;
  final DateTime assignedAt;

  factory UserSectorAssignment.fromJson(Map<String, dynamic> json) {
    return UserSectorAssignment(
      sectorId: json['sectorId'] as String,
      assignedAt: DateTime.parse(json['assignedAt'] as String),
    );
  }

  @override
  List<Object?> get props => [sectorId, assignedAt];
}

class UserAssignments extends Equatable {
  const UserAssignments({
    required this.userId,
    this.managerId,
    this.manager,
    required this.territories,
    required this.sectors,
    required this.isOperationallyActive,
  });

  final String userId;
  final String? managerId;
  final AssignmentManager? manager;
  final List<UserTerritoryAssignment> territories;
  final List<UserSectorAssignment> sectors;
  final bool isOperationallyActive;

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    return UserAssignments(
      userId: json['userId'] as String,
      managerId: json['managerId'] as String?,
      manager: json['manager'] == null
          ? null
          : AssignmentManager.fromJson(json['manager'] as Map<String, dynamic>),
      territories: (json['territories'] as List<dynamic>? ?? [])
          .map(
            (item) =>
                UserTerritoryAssignment.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sectors: (json['sectors'] as List<dynamic>? ?? [])
          .map(
            (item) =>
                UserSectorAssignment.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
    );
  }

  factory UserAssignments.fromRawJson(String json) {
    return UserAssignments.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  @override
  List<Object?> get props => [
    userId,
    managerId,
    manager,
    territories,
    sectors,
    isOperationallyActive,
  ];
}

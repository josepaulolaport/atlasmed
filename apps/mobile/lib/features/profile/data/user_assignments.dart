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
    required this.territoryName,
    this.boundary,
  });

  final String territoryId;
  final String territoryName;
  final Map<String, dynamic>? boundary;

  factory UserTerritoryAssignment.fromJson(Map<String, dynamic> json) {
    return UserTerritoryAssignment(
      territoryId: json['id'] as String? ?? json['territoryId'] as String,
      territoryName: (json['name'] as String?) ?? '—',
      boundary: json['boundary'] as Map<String, dynamic>?,
    );
  }

  @override
  List<Object?> get props => [territoryId, territoryName, boundary];
}

class UserVerticalAssignment extends Equatable {
  const UserVerticalAssignment({
    required this.verticalId,
    required this.verticalName,
    this.managerId,
    this.managerName,
    this.territories = const [],
    this.assignedAt,
  });

  final String verticalId;
  final String verticalName;
  final String? managerId;
  final String? managerName;
  final List<UserTerritoryAssignment> territories;
  final DateTime? assignedAt;

  factory UserVerticalAssignment.fromJson(Map<String, dynamic> json) {
    return UserVerticalAssignment(
      verticalId: json['verticalId'] as String,
      verticalName: (json['verticalName'] as String?) ?? '—',
      managerId: json['managerId'] as String?,
      managerName: json['managerName'] as String?,
      territories: (json['territories'] as List<dynamic>? ?? const [])
          .map(
            (item) => UserTerritoryAssignment.fromJson(
              item as Map<String, dynamic>,
            ),
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

  List<UserTerritoryAssignment> get territories =>
      verticals.expand((vertical) => vertical.territories).toList(growable: false);

  factory UserAssignments.fromJson(Map<String, dynamic> json) {
    final verticalRaw = json['verticalAssignments'] as List<dynamic>?;
    if (verticalRaw != null) {
      return UserAssignments(
        userId: json['userId'] as String,
        verticals: verticalRaw
            .map(
              (item) => UserVerticalAssignment.fromJson(
                item as Map<String, dynamic>,
              ),
            )
            .toList(),
        isOperationallyActive: json['isOperationallyActive'] as bool? ?? false,
      );
    }

    return UserAssignments(
      userId: json['userId'] as String,
      verticals: (json['verticals'] as List<dynamic>? ?? const [])
          .map(
            (item) => UserVerticalAssignment.fromJson(
              item as Map<String, dynamic>,
            ),
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

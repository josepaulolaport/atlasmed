import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Mirrors the DB `invitation_status` enum.
enum InvitationStatus { pending, accepted, expired, revoked }

extension InvitationStatusX on InvitationStatus {
  String get label {
    switch (this) {
      case InvitationStatus.pending:
        return 'Pendente';
      case InvitationStatus.accepted:
        return 'Aceito';
      case InvitationStatus.expired:
        return 'Expirado';
      case InvitationStatus.revoked:
        return 'Revogado';
    }
  }

  Color get color {
    switch (this) {
      case InvitationStatus.pending:
        return const AppColors.amber;
      case InvitationStatus.accepted:
        return const AppColors.green;
      case InvitationStatus.expired:
        return const AppColors.gray500;
      case InvitationStatus.revoked:
        return const AppColors.red;
    }
  }

  /// Only pending invites can still be edited.
  bool get isEditable => this == InvitationStatus.pending;
}

/// Mirrors an `invitations` row as returned by `GET /access/invitations`.
class UserInvitation extends Equatable {
  const UserInvitation({
    required this.id,
    required this.email,
    required this.roleName,
    required this.status,
    required this.invitedByName,
    this.roleId,
    this.firstName,
    this.lastName,
    this.birthDate,
    this.phoneNumber,
    this.managerName,
    this.territoryName,
    this.verticalAssignments = const [],
    required this.createdAt,
    required this.expiresAt,
    required this.resendCount,
  });

  final String id;
  final String email;
  final String roleName;
  final InvitationStatus status;
  final String invitedByName;

  /// Role id used when editing (e.g. `role-rep`). Optional on older list rows.
  final String? roleId;
  final String? firstName;
  final String? lastName;

  /// Calendar date from invite (`YYYY-MM-DD` on the wire).
  final DateTime? birthDate;
  final String? phoneNumber;

  /// Denormalized summary for list rows (first sector's manager / territories).
  final String? managerName;
  final String? territoryName;

  /// Full per-sector assignment payload — present for detail / edit.
  final List<InviteVerticalAssignment> verticalAssignments;

  final DateTime createdAt;
  final DateTime expiresAt;
  final int resendCount;

  String get displayName {
    final parts = [
      firstName,
      lastName,
    ].whereType<String>().map((s) => s.trim()).where((s) => s.isNotEmpty);
    if (parts.isEmpty) return email;
    return parts.join(' ');
  }

  factory UserInvitation.fromJson(Map<String, dynamic> json) => UserInvitation(
    id: json['id'] as String,
    email: json['email'] as String,
    roleName: json['roleName'] as String,
    roleId: json['roleId'] as String?,
    status: InvitationStatus.values.firstWhere(
      (s) => s.name.toUpperCase() == (json['status'] as String).toUpperCase(),
      orElse: () => InvitationStatus.pending,
    ),
    invitedByName: (json['invitedByName'] as String?) ?? '—',
    firstName: json['firstName'] as String?,
    lastName: json['lastName'] as String?,
    birthDate: _parseDateOnly(json['birthDate'] as String?),
    phoneNumber: json['phoneNumber'] as String?,
    managerName: json['managerName'] as String?,
    territoryName: json['territoryName'] as String?,
    verticalAssignments:
        (json['verticalAssignments'] as List<dynamic>? ?? const [])
            .map(
              (raw) => InviteVerticalAssignment(
                verticalId: raw['verticalId'] as String,
                verticalName: raw['verticalName'] as String,
                managerId: raw['managerId'] as String?,
                managerName: raw['managerName'] as String?,
                territories: (raw['territories'] as List<dynamic>? ?? const [])
                    .map(
                      (t) =>
                          TerritoryOption.fromJson(t as Map<String, dynamic>),
                    )
                    .toList(),
              ),
            )
            .toList(),
    createdAt: DateTime.parse(json['createdAt'] as String),
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    resendCount: json['resendCount'] as int? ?? 0,
  );

  UserInvitation copyWith({
    String? email,
    String? roleName,
    String? roleId,
    InvitationStatus? status,
    String? firstName,
    String? lastName,
    DateTime? birthDate,
    String? phoneNumber,
    String? managerName,
    String? territoryName,
    List<InviteVerticalAssignment>? verticalAssignments,
    DateTime? expiresAt,
    int? resendCount,
    bool clearManagerName = false,
    bool clearTerritoryName = false,
  }) {
    return UserInvitation(
      id: id,
      email: email ?? this.email,
      roleName: roleName ?? this.roleName,
      roleId: roleId ?? this.roleId,
      status: status ?? this.status,
      invitedByName: invitedByName,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      birthDate: birthDate ?? this.birthDate,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      managerName: clearManagerName ? null : (managerName ?? this.managerName),
      territoryName: clearTerritoryName
          ? null
          : (territoryName ?? this.territoryName),
      verticalAssignments: verticalAssignments ?? this.verticalAssignments,
      createdAt: createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      resendCount: resendCount ?? this.resendCount,
    );
  }

  static DateTime? _parseDateOnly(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final slice = raw.trim().length >= 10
        ? raw.trim().substring(0, 10)
        : raw.trim();
    final parts = slice.split('-');
    if (parts.length != 3) return DateTime.tryParse(raw);
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }

  @override
  List<Object?> get props => [
    id,
    email,
    roleName,
    roleId,
    status,
    invitedByName,
    firstName,
    lastName,
    birthDate,
    phoneNumber,
    managerName,
    territoryName,
    verticalAssignments,
    createdAt,
    expiresAt,
    resendCount,
  ];
}

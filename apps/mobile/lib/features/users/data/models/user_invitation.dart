import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

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
        return const Color(0xFFc6861b);
      case InvitationStatus.accepted:
        return const Color(0xFF16a373);
      case InvitationStatus.expired:
        return const Color(0xFF6b7280);
      case InvitationStatus.revoked:
        return const Color(0xFFb84545);
    }
  }
}

/// Mirrors an `invitations` row as returned by `GET /access/invitations`.
class UserInvitation extends Equatable {
  const UserInvitation({
    required this.id,
    required this.email,
    required this.roleName,
    required this.status,
    required this.invitedByName,
    this.managerName,
    this.territoryName,
    required this.createdAt,
    required this.expiresAt,
    required this.resendCount,
  });

  final String id;
  final String email;
  final String roleName;
  final InvitationStatus status;
  final String invitedByName;
  final String? managerName;
  final String? territoryName;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int resendCount;

  factory UserInvitation.fromJson(Map<String, dynamic> json) => UserInvitation(
    id: json['id'] as String,
    email: json['email'] as String,
    roleName: json['roleName'] as String,
    status: InvitationStatus.values.firstWhere(
      (s) => s.name.toUpperCase() == (json['status'] as String).toUpperCase(),
      orElse: () => InvitationStatus.pending,
    ),
    invitedByName: (json['invitedByName'] as String?) ?? '—',
    managerName: json['managerName'] as String?,
    territoryName: json['territoryName'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    resendCount: json['resendCount'] as int? ?? 0,
  );

  UserInvitation copyWith({InvitationStatus? status, int? resendCount}) {
    return UserInvitation(
      id: id,
      email: email,
      roleName: roleName,
      status: status ?? this.status,
      invitedByName: invitedByName,
      managerName: managerName,
      territoryName: territoryName,
      createdAt: createdAt,
      expiresAt: expiresAt,
      resendCount: resendCount ?? this.resendCount,
    );
  }

  @override
  List<Object?> get props => [
    id,
    email,
    roleName,
    status,
    invitedByName,
    managerName,
    territoryName,
    createdAt,
    expiresAt,
    resendCount,
  ];
}

import 'package:equatable/equatable.dart';

/// Mirrors a row from the `permissions` table (AccessGrants), as exposed by
/// `GET /access/users/:id/capabilities` and mutated via
/// `POST`/`DELETE /access/users/:id/permissions`.
class PermissionGrant extends Equatable {
  const PermissionGrant({
    required this.id,
    required this.resource,
    required this.action,
    this.resourceId,
    this.resourceName,
    this.grantedByName,
    required this.grantedAt,
    this.expiresAt,
  });

  final String id;

  /// Subject, e.g. `USER`, `FACILITY`, `TERRITORY`.
  final String resource;

  /// `create` | `read` | `update` | `delete` | `manage`.
  final String action;
  final String? resourceId;
  final String? resourceName;
  final String? grantedByName;
  final DateTime grantedAt;
  final DateTime? expiresAt;

  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());

  factory PermissionGrant.fromJson(Map<String, dynamic> json) =>
      PermissionGrant(
        id: json['id'] as String,
        resource: json['resource'] as String,
        action: json['action'] as String,
        resourceId: json['resourceId'] as String?,
        resourceName: json['resourceName'] as String?,
        grantedByName: json['grantedByName'] as String?,
        grantedAt: DateTime.parse(json['grantedAt'] as String),
        expiresAt: json['expiresAt'] != null
            ? DateTime.parse(json['expiresAt'] as String)
            : null,
      );

  @override
  List<Object?> get props => [
    id,
    resource,
    action,
    resourceId,
    resourceName,
    grantedByName,
    grantedAt,
    expiresAt,
  ];
}

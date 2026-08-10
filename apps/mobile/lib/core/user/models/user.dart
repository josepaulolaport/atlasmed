import 'package:equatable/equatable.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'user_role_name.dart';
import 'user_status.dart';

class UserRole extends Equatable {
  const UserRole({required this.id, required this.name, this.description});

  final int id;
  final UserRoleName name;
  final String? description;

  factory UserRole.fromJson(Map<String, dynamic> json) => UserRole(
    id: readCrmId(json['id'], 'id'),
    name: UserRoleName.values.firstWhere(
      (e) => e.name.toUpperCase() == _string(json['name']).toUpperCase(),
      orElse: () => UserRoleName.rep,
    ),
    description: _stringOrNull(json['description']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name.name.toUpperCase(),
    if (description != null) 'description': description,
  };

  @override
  List<Object?> get props => [id, name, description];
}

class User extends Equatable {
  const User({
    required this.id,
    required this.email,
    required this.username,
    this.phoneNumber,
    this.firstName,
    this.lastName,
    this.avatarUrl,
    this.avatarBlurhash,
    required this.status,
    required this.emailVerified,
    required this.phoneVerified,
    required this.twoFactorEnabled,
    this.emailVerifiedAt,
    this.phoneVerifiedAt,
    required this.role,
    required this.createdAt,
    required this.updatedAt,
    this.lastLoginAt,
    this.suspendedAt,
    this.deactivatedAt,
    this.birthDate,
  });

  final int id;
  final String email;
  final String username;
  final String? phoneNumber;
  final String? firstName;
  final String? lastName;
  final String? avatarUrl;
  final String? avatarBlurhash;
  final UserStatus status;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final DateTime? emailVerifiedAt;
  final DateTime? phoneVerifiedAt;
  final UserRole role;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Mirrors `users.last_login_at` — `null` when the user has never signed
  /// in (e.g. a still-`PENDING` invitee).
  final DateTime? lastLoginAt;

  /// Mirrors `users.suspended_at` / `users.deactivated_at` — only ever set
  /// while [status] is [UserStatus.suspended] / [UserStatus.inactive]
  /// respectively, kept so the profile can show "since when".
  final DateTime? suspendedAt;
  final DateTime? deactivatedAt;

  /// Not part of the `users` table yet — seeded here ahead of a future
  /// backend column so the basic-info card has something to show.
  final DateTime? birthDate;

  String get displayName {
    final parts = [
      firstName,
      lastName,
    ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');

    if (parts.isNotEmpty) return parts;
    if (username.isNotEmpty) return username;
    return email;
  }

  User copyWith({
    String? email,
    String? username,
    String? phoneNumber,
    String? firstName,
    String? lastName,
    String? avatarUrl,
    String? avatarBlurhash,
    UserStatus? status,
    bool? emailVerified,
    bool? phoneVerified,
    bool? twoFactorEnabled,
    DateTime? emailVerifiedAt,
    DateTime? phoneVerifiedAt,
    UserRole? role,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? lastLoginAt,
    DateTime? suspendedAt,
    DateTime? deactivatedAt,
    DateTime? birthDate,
    bool clearPhoneNumber = false,
    bool clearBirthDate = false,
    bool clearSuspendedAt = false,
    bool clearDeactivatedAt = false,
  }) {
    return User(
      id: id,
      email: email ?? this.email,
      username: username ?? this.username,
      phoneNumber: clearPhoneNumber ? null : (phoneNumber ?? this.phoneNumber),
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      avatarBlurhash: avatarBlurhash ?? this.avatarBlurhash,
      status: status ?? this.status,
      emailVerified: emailVerified ?? this.emailVerified,
      phoneVerified: phoneVerified ?? this.phoneVerified,
      twoFactorEnabled: twoFactorEnabled ?? this.twoFactorEnabled,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      phoneVerifiedAt: phoneVerifiedAt ?? this.phoneVerifiedAt,
      role: role ?? this.role,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      suspendedAt: clearSuspendedAt ? null : (suspendedAt ?? this.suspendedAt),
      deactivatedAt: clearDeactivatedAt
          ? null
          : (deactivatedAt ?? this.deactivatedAt),
      birthDate: clearBirthDate ? null : (birthDate ?? this.birthDate),
    );
  }

  factory User.fromJson(Map<String, dynamic> json) {
    final userJson = json.containsKey('user')
        ? json['user'] as Map<String, dynamic>
        : json;

    return User(
      id: readCrmId(userJson['id'], 'id'),
      email: _string(userJson['email']),
      username: _string(userJson['username']),
      phoneNumber: _stringOrNull(userJson['phoneNumber']),
      firstName: _stringOrNull(userJson['firstName']),
      lastName: _stringOrNull(userJson['lastName']),
      avatarUrl: _stringOrNull(userJson['avatarUrl']),
      avatarBlurhash: _stringOrNull(userJson['avatarBlurhash']),
      status: UserStatus.values.firstWhere(
        (e) =>
            e.name.toUpperCase() == _string(userJson['status']).toUpperCase(),
        orElse: () => UserStatus.active,
      ),
      emailVerified: userJson['emailVerified'] as bool? ?? false,
      phoneVerified: userJson['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: userJson['twoFactorEnabled'] as bool? ?? false,
      emailVerifiedAt: _dateTimeOrNull(userJson['emailVerifiedAt']),
      phoneVerifiedAt: _dateTimeOrNull(userJson['phoneVerifiedAt']),
      role: UserRole.fromJson(userJson['role'] as Map<String, dynamic>),
      createdAt: DateTime.parse(_string(userJson['createdAt'])),
      updatedAt: DateTime.parse(_string(userJson['updatedAt'])),
      lastLoginAt: _dateTimeOrNull(userJson['lastLoginAt']),
      suspendedAt: _dateTimeOrNull(userJson['suspendedAt']),
      deactivatedAt: _dateTimeOrNull(userJson['deactivatedAt']),
      birthDate: _dateTimeOrNull(userJson['birthDate']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'username': username,
    if (phoneNumber != null) 'phoneNumber': phoneNumber,
    if (firstName != null) 'firstName': firstName,
    if (lastName != null) 'lastName': lastName,
    if (avatarUrl != null) 'avatarUrl': avatarUrl,
    if (avatarBlurhash != null) 'avatarBlurhash': avatarBlurhash,
    'status': status.name.toUpperCase(),
    'emailVerified': emailVerified,
    'phoneVerified': phoneVerified,
    'twoFactorEnabled': twoFactorEnabled,
    if (emailVerifiedAt != null)
      'emailVerifiedAt': emailVerifiedAt!.toIso8601String(),
    if (phoneVerifiedAt != null)
      'phoneVerifiedAt': phoneVerifiedAt!.toIso8601String(),
    'role': role.toJson(),
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    if (lastLoginAt != null) 'lastLoginAt': lastLoginAt!.toIso8601String(),
    if (suspendedAt != null) 'suspendedAt': suspendedAt!.toIso8601String(),
    if (deactivatedAt != null)
      'deactivatedAt': deactivatedAt!.toIso8601String(),
    if (birthDate != null) 'birthDate': birthDate!.toIso8601String(),
  };

  @override
  List<Object?> get props => [
    id,
    email,
    username,
    phoneNumber,
    firstName,
    lastName,
    avatarUrl,
    avatarBlurhash,
    status,
    emailVerified,
    phoneVerified,
    twoFactorEnabled,
    emailVerifiedAt,
    phoneVerifiedAt,
    role,
    createdAt,
    updatedAt,
    lastLoginAt,
    suspendedAt,
    deactivatedAt,
    birthDate,
  ];
}

DateTime? _dateTimeOrNull(Object? value) {
  final raw = _stringOrNull(value);
  if (raw != null && raw.isNotEmpty) {
    return DateTime.parse(raw);
  }
  return null;
}

String _string(Object? value) => value?.toString() ?? '';

String? _stringOrNull(Object? value) => value?.toString();

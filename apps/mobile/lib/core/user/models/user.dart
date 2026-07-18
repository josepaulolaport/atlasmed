import 'package:equatable/equatable.dart';

import 'user_role_name.dart';
import 'user_status.dart';

class UserRole extends Equatable {
  const UserRole({required this.id, required this.name, this.description});

  final String id;
  final UserRoleName name;
  final String? description;

  factory UserRole.fromJson(Map<String, dynamic> json) => UserRole(
    id: json['id'] as String,
    name: UserRoleName.values.firstWhere(
      (e) => e.name.toUpperCase() == (json['name'] as String).toUpperCase(),
      orElse: () => UserRoleName.rep,
    ),
    description: json['description'] as String?,
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

  final String id;
  final String email;
  final String username;
  final String? phoneNumber;
  final String? firstName;
  final String? lastName;
  final String? avatarUrl;
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
      id: userJson['id'] as String,
      email: userJson['email'] as String,
      username: userJson['username'] as String,
      phoneNumber: userJson['phoneNumber'] as String?,
      firstName: userJson['firstName'] as String?,
      lastName: userJson['lastName'] as String?,
      avatarUrl: userJson['avatarUrl'] as String?,
      status: UserStatus.values.firstWhere(
        (e) =>
            e.name.toUpperCase() ==
            (userJson['status'] as String).toUpperCase(),
        orElse: () => UserStatus.active,
      ),
      emailVerified: userJson['emailVerified'] as bool? ?? false,
      phoneVerified: userJson['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: userJson['twoFactorEnabled'] as bool? ?? false,
      emailVerifiedAt: _dateTimeOrNull(userJson['emailVerifiedAt']),
      phoneVerifiedAt: _dateTimeOrNull(userJson['phoneVerifiedAt']),
      role: UserRole.fromJson(userJson['role'] as Map<String, dynamic>),
      createdAt: DateTime.parse(userJson['createdAt'] as String),
      updatedAt: DateTime.parse(userJson['updatedAt'] as String),
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
  if (value is String && value.isNotEmpty) {
    return DateTime.parse(value);
  }
  return null;
}

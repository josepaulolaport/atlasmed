import 'package:equatable/equatable.dart';

class UserRole extends Equatable {
  const UserRole({required this.id, required this.name, this.description});

  final String id;
  final String name;
  final String? description;

  factory UserRole.fromJson(Map<String, dynamic> json) => UserRole(
    id: json['id'] as String,
    name: json['name'] as String,
    description: json['description'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
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
  });

  final String id;
  final String email;
  final String username;
  final String? phoneNumber;
  final String? firstName;
  final String? lastName;
  final String? avatarUrl;
  final String status;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final DateTime? emailVerifiedAt;
  final DateTime? phoneVerifiedAt;
  final UserRole role;
  final DateTime createdAt;
  final DateTime updatedAt;

  String get displayName {
    final parts = [
      firstName,
      lastName,
    ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');

    if (parts.isNotEmpty) return parts;
    if (username.isNotEmpty) return username;
    return email;
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
      status: userJson['status'] as String,
      emailVerified: userJson['emailVerified'] as bool? ?? false,
      phoneVerified: userJson['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: userJson['twoFactorEnabled'] as bool? ?? false,
      emailVerifiedAt: _dateTimeOrNull(userJson['emailVerifiedAt']),
      phoneVerifiedAt: _dateTimeOrNull(userJson['phoneVerifiedAt']),
      role: UserRole.fromJson(userJson['role'] as Map<String, dynamic>),
      createdAt: DateTime.parse(userJson['createdAt'] as String),
      updatedAt: DateTime.parse(userJson['updatedAt'] as String),
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
    'status': status,
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
  ];
}

DateTime? _dateTimeOrNull(Object? value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.parse(value);
  }
  return null;
}

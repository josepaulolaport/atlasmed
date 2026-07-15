import 'package:equatable/equatable.dart';

class UserRole extends Equatable {
  const UserRole({
    required this.id,
    required this.name,
    this.description,
  });

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
    this.firstName,
    this.lastName,
    required this.status,
    required this.emailVerified,
    required this.phoneVerified,
    required this.role,
  });

  final String id;
  final String email;
  final String username;
  final String? firstName;
  final String? lastName;
  final String status;
  final bool emailVerified;
  final bool phoneVerified;
  final UserRole role;

  String get displayName {
    final parts = [firstName, lastName]
        .whereType<String>()
        .where((part) => part.trim().isNotEmpty)
        .join(' ');

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
      firstName: userJson['firstName'] as String?,
      lastName: userJson['lastName'] as String?,
      status: userJson['status'] as String,
      emailVerified: userJson['emailVerified'] as bool? ?? false,
      phoneVerified: userJson['phoneVerified'] as bool? ?? false,
      role: UserRole.fromJson(userJson['role'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'username': username,
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        'status': status,
        'emailVerified': emailVerified,
        'phoneVerified': phoneVerified,
        'role': role.toJson(),
      };

  @override
  List<Object?> get props => [
        id,
        email,
        username,
        firstName,
        lastName,
        status,
        emailVerified,
        phoneVerified,
        role,
      ];
}

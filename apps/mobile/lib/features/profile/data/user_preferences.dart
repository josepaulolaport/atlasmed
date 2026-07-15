import 'dart:convert';

import 'package:equatable/equatable.dart';

enum UserPreferenceTheme { system, light, dark }

class UserPreferences extends Equatable {
  const UserPreferences({
    required this.theme,
    required this.pushNotificationsEnabled,
    required this.emailNotificationsEnabled,
    required this.smsNotificationsEnabled,
  });

  final UserPreferenceTheme theme;
  final bool pushNotificationsEnabled;
  final bool emailNotificationsEnabled;
  final bool smsNotificationsEnabled;

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      theme: UserPreferenceTheme.values.firstWhere(
        (value) => value.name == (json['theme'] as String? ?? 'system'),
        orElse: () => UserPreferenceTheme.system,
      ),
      pushNotificationsEnabled:
          json['pushNotificationsEnabled'] as bool? ?? true,
      emailNotificationsEnabled:
          json['emailNotificationsEnabled'] as bool? ?? true,
      smsNotificationsEnabled:
          json['smsNotificationsEnabled'] as bool? ?? false,
    );
  }

  factory UserPreferences.fromRawJson(String json) {
    return UserPreferences.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  Map<String, dynamic> toJson() => {
    'theme': theme.name,
    'pushNotificationsEnabled': pushNotificationsEnabled,
    'emailNotificationsEnabled': emailNotificationsEnabled,
    'smsNotificationsEnabled': smsNotificationsEnabled,
  };

  @override
  List<Object?> get props => [
    theme,
    pushNotificationsEnabled,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
  ];
}

class UpdateUserPreferencesPayload {
  const UpdateUserPreferencesPayload({
    this.theme,
    this.pushNotificationsEnabled,
    this.emailNotificationsEnabled,
    this.smsNotificationsEnabled,
  });

  final UserPreferenceTheme? theme;
  final bool? pushNotificationsEnabled;
  final bool? emailNotificationsEnabled;
  final bool? smsNotificationsEnabled;

  Map<String, dynamic> toJson() => {
    if (theme != null) 'theme': theme!.name,
    if (pushNotificationsEnabled != null)
      'pushNotificationsEnabled': pushNotificationsEnabled,
    if (emailNotificationsEnabled != null)
      'emailNotificationsEnabled': emailNotificationsEnabled,
    if (smsNotificationsEnabled != null)
      'smsNotificationsEnabled': smsNotificationsEnabled,
  };
}

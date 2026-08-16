import 'dart:convert';

import 'package:equatable/equatable.dart';

enum UserPreferenceTheme { system, light, dark }

class UserPreferences extends Equatable {
  const UserPreferences({
    required this.theme,
    required this.pushNotificationsEnabled,
    required this.emailNotificationsEnabled,
    required this.smsNotificationsEnabled,
    this.workdayStart,
    this.workdayEnd,
  });

  final UserPreferenceTheme theme;
  final bool pushNotificationsEnabled;
  final bool emailNotificationsEnabled;
  final bool smsNotificationsEnabled;

  /// When this rep actually works, `HH:MM`. Null means not set — the roteiro
  /// falls back to the linha's hours rather than freezing today's default.
  final String? workdayStart;
  final String? workdayEnd;

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
      workdayStart: json['workdayStart'] as String?,
      workdayEnd: json['workdayEnd'] as String?,
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
    'workdayStart': workdayStart,
    'workdayEnd': workdayEnd,
  };

  @override
  List<Object?> get props => [
    theme,
    pushNotificationsEnabled,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    workdayStart,
    workdayEnd,
  ];
}

class UpdateUserPreferencesPayload {
  const UpdateUserPreferencesPayload({
    this.theme,
    this.pushNotificationsEnabled,
    this.emailNotificationsEnabled,
    this.smsNotificationsEnabled,
    this.workdayStart,
    this.workdayEnd,
    this.includeWorkingHours = false,
  });

  /// Emit the four hour fields verbatim, nulls included.
  ///
  /// Needed because clearing an hour back to "follow the linha" *is* the edit,
  /// and the usual omit-if-null rule would make it unsayable — the server would
  /// read the absence as "leave it alone" and the rep's reset would vanish.
  final bool includeWorkingHours;

  final UserPreferenceTheme? theme;
  final bool? pushNotificationsEnabled;
  final bool? emailNotificationsEnabled;
  final bool? smsNotificationsEnabled;
  final String? workdayStart;
  final String? workdayEnd;

  Map<String, dynamic> toJson() => {
    if (theme != null) 'theme': theme!.name,
    if (pushNotificationsEnabled != null)
      'pushNotificationsEnabled': pushNotificationsEnabled,
    if (emailNotificationsEnabled != null)
      'emailNotificationsEnabled': emailNotificationsEnabled,
    if (smsNotificationsEnabled != null)
      'smsNotificationsEnabled': smsNotificationsEnabled,
    if (includeWorkingHours) ...{
      'workdayStart': workdayStart,
      'workdayEnd': workdayEnd,
    },
  };
}

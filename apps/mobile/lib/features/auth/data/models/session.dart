import 'package:equatable/equatable.dart';

import 'user.dart';

class Session extends Equatable {
  const Session({
    required this.token,
    required this.refreshToken,
    required this.user,
  });

  final String token;
  final String refreshToken;
  final User user;

  factory Session.fromJson(Map<String, dynamic> json) {
    final sessionJson = json.containsKey('session')
        ? json['session'] as Map<String, dynamic>
        : json;

    return Session(
      token: sessionJson['token'] as String,
      refreshToken: sessionJson['refreshToken'] as String,
      user: User.fromJson(json),
    );
  }

  Map<String, dynamic> toJson() => {
    'session': {'token': token, 'refreshToken': refreshToken},
    'user': user.toJson(),
  };

  @override
  List<Object?> get props => [true];
}

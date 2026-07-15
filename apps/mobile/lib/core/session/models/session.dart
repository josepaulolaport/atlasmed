import 'package:equatable/equatable.dart';

class Session extends Equatable {
  const Session({required this.token, required this.refreshToken});

  final String token;
  final String refreshToken;

  factory Session.fromJson(Map<String, dynamic> json) {
    final sessionJson = json.containsKey('session')
        ? json['session'] as Map<String, dynamic>
        : json;

    return Session(
      token: sessionJson['token'] as String,
      refreshToken: sessionJson['refreshToken'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'session': {'token': token, 'refreshToken': refreshToken},
  };

  @override
  List<Object?> get props => [token, refreshToken];
}

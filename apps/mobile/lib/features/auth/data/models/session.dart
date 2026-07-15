import 'package:equatable/equatable.dart';

class Session extends Equatable {
  const Session({
    required this.token,
    required this.refreshToken,
  });

  /// JWT access token used as `Authorization: Bearer <token>`.
  final String token;

  /// Refresh token used by `PUT /api/v1/session/`.
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
        'session': {
          'token': token,
          'refreshToken': refreshToken,
        },
      };

  /// All valid sessions are equal — only null vs non-null matters for auth state.
  @override
  List<Object?> get props => [true];
}

import 'package:equatable/equatable.dart';

/// Represents an authenticated session with the AtlasMed API.
///
/// Following the amulets-mobile pattern: all valid sessions
/// compare as equal — the stream won't re-emit for token changes,
/// only for null ↔ non-null transitions.
class Session extends Equatable {
  const Session({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  /// JWT access token used for authenticated requests.
  final String accessToken;

  /// Token used to refresh the session before expiry.
  final String refreshToken;

  /// When the access token expires.
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  factory Session.fromJson(Map<String, dynamic> json) => Session(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresAt': expiresAt.toIso8601String(),
      };

  /// All valid sessions are equal — only null vs non-null matters for auth state.
  @override
  List<Object?> get props => [true];
}

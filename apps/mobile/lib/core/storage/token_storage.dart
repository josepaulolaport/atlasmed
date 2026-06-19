import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';
  static const _userIdKey = 'user_id';
  static const _displayNameKey = 'display_name';
  static const _expiresAtKey = 'expires_at';

  final FlutterSecureStorage _storage;

  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  Future<void> saveSession({
    required String userId,
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
    required String userDisplayName,
  }) async {
    await Future.wait([
      _storage.write(key: _accessKey, value: accessToken),
      _storage.write(key: _refreshKey, value: refreshToken),
      _storage.write(key: _userIdKey, value: userId),
      _storage.write(key: _displayNameKey, value: userDisplayName),
      _storage.write(key: _expiresAtKey, value: expiresAt.toIso8601String()),
    ]);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<Map<String, String>?> readSession() async {
    final accessToken = await readAccessToken();
    final refreshToken = await readRefreshToken();
    final userId = await _storage.read(key: _userIdKey);
    final displayName = await _storage.read(key: _displayNameKey);
    final expiresAt = await _storage.read(key: _expiresAtKey);

    if (accessToken == null ||
        refreshToken == null ||
        userId == null ||
        displayName == null ||
        expiresAt == null) {
      return null;
    }

    return {
      'userId': userId,
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'userDisplayName': displayName,
      'expiresAt': expiresAt,
    };
  }

  Future<void> clear() async {
    await _storage.deleteAll();
  }
}

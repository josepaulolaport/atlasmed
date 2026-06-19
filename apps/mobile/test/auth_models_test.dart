import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models.dart';

void main() {
  group('auth models', () {
    test('LoginRequest serializes identifier for API', () {
      const request = LoginRequest(
        email: 'admin@atlasmed.com',
        password: 'admin123456',
      );

      expect(request.toJson(), {
        'identifier': 'admin@atlasmed.com',
        'password': 'admin123456',
      });
    });

    test('ResetPasswordRequest serializes token flow', () {
      const request = ResetPasswordRequest(
        token: 'reset-token-abc',
        newPassword: 'NewPassword123!',
      );

      expect(request.toJson(), {
        'token': 'reset-token-abc',
        'newPassword': 'NewPassword123!',
      });
    });

    test('AuthSession detects expiry', () {
      final expired = AuthSession(
        userId: 'u1',
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
        userDisplayName: 'Test User',
      );

      final valid = AuthSession(
        userId: 'u1',
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
        userDisplayName: 'Test User',
      );

      expect(expired.isExpired, isTrue);
      expect(valid.isExpired, isFalse);
    });

    test('AuthSession round-trips json', () {
      final session = AuthSession(
        userId: 'u1',
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: DateTime.parse('2026-01-01T12:00:00.000Z'),
        userDisplayName: 'Admin',
      );

      final restored = AuthSession.fromJson(session.toJson());

      expect(restored.userId, session.userId);
      expect(restored.accessToken, session.accessToken);
      expect(restored.userDisplayName, session.userDisplayName);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models/user.dart';
import 'package:atlasmed_mobile_app/features/profile/data/avatar_repository.dart';

void main() {
  final user = User(
    id: 'user-1',
    email: 'ana@example.com',
    username: 'ana',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: false,
    role: UserRole(id: 'role-1', name: 'USER'),
    twoFactorEnabled: false,
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );

  test('formats a multipart avatar request with its bearer token', () async {
    final repository = AvatarRepository(
      baseUrl: 'https://api.example.test',
      tokenProvider: () async => 'token-123',
      request: (request) async {
        expect(
          request.url.toString(),
          'https://api.example.test/api/v1/user/avatar',
        );
        expect(request.method, 'POST');
        expect(request.headers['Authorization'], 'Bearer token-123');
        return {
          'user': {
            ...user.toJson(),
            'avatarUrl': 'https://api.example.test/avatar.png',
          },
        };
      },
    );

    final updated = await repository.upload(
      AvatarFile(
        name: 'avatar.png',
        bytes: [1, 2, 3],
        contentType: 'image/png',
      ),
    );

    expect(updated.avatarUrl, 'https://api.example.test/avatar.png');
  });
}

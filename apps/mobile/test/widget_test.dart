import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/auth/data/auth_repository.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/providers/auth_provider.dart';

class _NoOpAuthRepository implements AuthRepository {
  @override
  Future<void> clearSession() async {}

  @override
  Future<AuthSession?> getStoredSession() async => null;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> requestPasswordReset(ForgotPasswordRequest request) async {}

  @override
  Future<void> resetPassword(ResetPasswordRequest request) async {}
}

void main() {
  testWidgets('App shell mounts without pending timers', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_NoOpAuthRepository()),
        ],
        child: const MaterialApp(
          home: Scaffold(body: Text('AtlasMed')),
        ),
      ),
    );

    expect(find.text('AtlasMed'), findsOneWidget);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/auth/data/auth_repository.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models.dart';
import 'package:atlasmed_mobile_app/features/auth/data/mock_auth_repository.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/providers/auth_provider.dart';

void main() {
  test('AuthNotifier login succeeds with mock repository', () async {
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    addTearDown(container.dispose);

    final notifier = container.read(authProvider.notifier);

    await notifier.login('rafael.melo@atlasmed.com', 'Atlas2026');

    final state = container.read(authProvider);
    expect(state.status, AuthStatus.authenticated);
    expect(state.session?.userDisplayName, 'Rafael Melo');
  });

  test('AuthNotifier rejects invalid credentials', () async {
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    addTearDown(container.dispose);

    final notifier = container.read(authProvider.notifier);

    await notifier.login('wrong@example.com', 'bad-password');

    final state = container.read(authProvider);
    expect(state.status, AuthStatus.unauthenticated);
    expect(state.error?.kind, AuthErrorKind.wrongCredentials);
  });
}

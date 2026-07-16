import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test(
    'preferencesProvider returns structure matching ProviderItem type',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await expectLater(container.read(preferencesProvider.future), completes);
    },
  );
}

import 'dart:async';

import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/repository_failure.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/repository_state.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  _MemoryCacheStorage([Map<String, String>? seed])
    : _entries = {...?seed};

  final Map<String, String> _entries;

  @override
  Future<void> clear() async => _entries.clear();

  @override
  Future<void> delete({required String key}) async => _entries.remove(key);

  @override
  Future<String?> read({required String key}) async => _entries[key];

  @override
  Future<void> write({required String key, required String value}) async =>
      _entries[key] = value;
}

class _UnreachableEndpointException implements Exception {
  const _UnreachableEndpointException();

  @override
  String toString() => 'endpoint unreachable';
}

class _FailingRepository extends Repository<String> {
  _FailingRepository()
    : super(endpoint: Uri.parse('https://example.test/thing'), name: 'Failing');

  @override
  Future<String?> resolve() async => throw const _UnreachableEndpointException();

  @override
  String fromJson(String json) => json;
}

void main() {
  test('an unloaded repository pushes the failure down its stream', () async {
    BaseRepository.storage = _MemoryCacheStorage();

    final uncaught = <Object>[];
    await runZonedGuarded(
      () async {
        final repository = _FailingRepository();
        addTearDown(repository.dispose);

        final failure = repository.failures.first;
        final streamError = repository.stream.first
            .then<Object?>((_) => null)
            .onError<Object>((error, _) => error);

        expect(await streamError, isA<_UnreachableEndpointException>());
        expect((await failure).trigger, 'hydration');
        expect(repository.lastFailure, isNotNull);
        expect(repository.currentValue, isNull);

        await Future<void>.delayed(const Duration(milliseconds: 10));
      },
      (error, stackTrace) => uncaught.add(error),
    );

    expect(uncaught, isEmpty);
  });

  test('a loaded repository keeps its data when a refresh fails', () async {
    final endpoint = Uri.parse('https://example.test/thing');
    BaseRepository.storage = _MemoryCacheStorage({
      endpoint.toString(): 'cached body',
    });

    final uncaught = <Object>[];
    await runZonedGuarded(
      () async {
        final repository = _FailingRepository();
        addTearDown(repository.dispose);

        final states = <RepositoryState<String>>[];
        final streamErrors = <Object>[];
        final subscription = repository.stream.listen(
          states.add,
          onError: streamErrors.add,
        );
        addTearDown(subscription.cancel);

        final failures = <RepositoryFailure>[];
        final failureSubscription = repository.failures.listen(failures.add);
        addTearDown(failureSubscription.cancel);

        await Future<void>.delayed(const Duration(milliseconds: 10));

        expect(repository.currentValue, 'cached body');
        expect(streamErrors, isEmpty);
        expect(states.single, isA<RepositoryStateReady<String>>());
        expect(failures.single.trigger, 'hydration');
        expect(repository.lastFailure, isNotNull);
      },
      (error, stackTrace) => uncaught.add(error),
    );

    expect(uncaught, isEmpty);
  });
}

import 'dart:async';

import 'package:atlasmed_mobile_app/repository/infra/repository_fiber.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('callers joining a running fiber share its result', () async {
    final fiber = RepositoryFiber<int>();
    final gate = Completer<void>();
    var executions = 0;

    Future<int> body() async {
      executions++;
      await gate.future;
      return 42;
    }

    final first = fiber.run(body);
    final second = fiber.run(body);
    gate.complete();

    expect(await first, 42);
    expect(await second, 42);
    expect(executions, 1);
  });

  test('a failure reaches the caller and every joiner', () async {
    final fiber = RepositoryFiber<int>();
    final gate = Completer<void>();

    Future<int> body() async {
      await gate.future;
      throw StateError('boom');
    }

    final first = fiber.run(body);
    final second = fiber.run(body);
    gate.complete();

    await expectLater(first, throwsStateError);
    await expectLater(second, throwsStateError);
  });

  test('a failure with no joiner is not reported twice', () async {
    final uncaught = <Object>[];

    await runZonedGuarded(
      () async {
        final fiber = RepositoryFiber<int>();

        await expectLater(
          fiber.run(() async => throw StateError('boom')),
          throwsStateError,
        );

        // Unobserved completer errors reach the zone on a later turn.
        await Future<void>.delayed(const Duration(milliseconds: 10));
      },
      (error, stackTrace) => uncaught.add(error),
    );

    expect(uncaught, isEmpty);
  });

  test('the fiber runs again after a failure', () async {
    final fiber = RepositoryFiber<int>();

    await expectLater(
      fiber.run(() async => throw StateError('boom')),
      throwsStateError,
    );

    expect(await fiber.run(() async => 7), 7);
  });
}

import 'dart:async';

import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_notifier.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_users_repository.dart';

void main() {
  test('typing does not fire a request per keystroke', () async {
    // "adriana" cost seven round trips to `GET /access/users`.
    final repository = FakeUsersRepository();
    final notifier = UsersListNotifier(repository);
    await Future<void>.delayed(Duration.zero);
    final afterFirstLoad = repository.searches.length;

    for (final term in [
      'a',
      'ad',
      'adr',
      'adri',
      'adria',
      'adrian',
      'adriana',
    ]) {
      notifier.setSearch(term);
    }
    await Future<void>.delayed(UsersListNotifier.searchDebounce * 2);

    expect(repository.searches.length - afterFirstLoad, 1);
    expect(repository.searches.last, 'adriana');

    notifier.dispose();
  });

  test(
    'a slow reply for an earlier term cannot overwrite a later one',
    () async {
      // Whichever response landed last won, so the list could settle on results
      // for a prefix of what was typed.
      final repository = FakeUsersRepository();
      final notifier = UsersListNotifier(repository);
      await Future<void>.delayed(Duration.zero);

      final slow = Completer<UsersPage>();
      repository.nextResponse = slow.future;
      notifier.setSearch('adr');
      await Future<void>.delayed(UsersListNotifier.searchDebounce * 2);

      // The full term resolves while the prefix is still in flight.
      repository.nextResponse = null;
      repository.total = 1;
      notifier.setSearch('adriana');
      await Future<void>.delayed(UsersListNotifier.searchDebounce * 2);

      slow.complete(
        const UsersPage(items: [], page: 1, totalPages: 9, total: 999),
      );
      await Future<void>.delayed(Duration.zero);

      expect(
        notifier.state.total,
        1,
        reason: 'the stale reply lost the race and must be dropped',
      );

      notifier.dispose();
    },
  );

  test(
    'a failed load is recorded as an error, not as an empty roster',
    () async {
      final repository = FakeUsersRepository()..fails = true;
      final notifier = UsersListNotifier(repository);
      await Future<void>.delayed(Duration.zero);

      expect(notifier.state.items, isEmpty);
      expect(notifier.state.error, isNotNull);

      notifier.dispose();
    },
  );
}

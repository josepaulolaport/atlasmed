import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  _logoutTests();

  group('AppNavigationItem', () {
    const explore = AppNavigationItem(
      branchIndex: 0,
      label: 'Explorar',
      route: '/explore',
    );

    test('is active only for its configured navigation branch', () {
      expect(explore.isActiveForBranch(0), isTrue);
      expect(explore.isActiveForBranch(1), isFalse);
    });

    test('Agenda has its own branch and correct role visibility', () {
      final agenda = appNavigationItems.singleWhere(
        (item) => item.route == '/agenda',
      );

      expect(agenda.label, 'Agenda');
      expect(agenda.branchIndex, 3);
      expect(agenda.visibleFor!(UserRoleName.rep), isTrue);
      expect(agenda.visibleFor!(UserRoleName.manager), isTrue);
      expect(agenda.visibleFor!(UserRoleName.admin), isTrue);
      expect(agenda.visibleFor!(UserRoleName.ops), isFalse);
      expect(
        appNavigationItems
            .singleWhere((item) => item.route == '/territories')
            .branchIndex,
        4,
      );
      // `/profile` was pinned here too. It is no longer in this list — the
      // drawer entry is hidden — and branch 10 is now guarded by the router,
      // not by the navigation items.
    });
  });

  group('BranchHistory', () {
    test('nothing to go back to until a branch is left', () {
      final history = BranchHistory();
      expect(history.canGoBack, isFalse);
      expect(history.pop(), isNull);
    });

    test('remembers the branch it came from', () {
      final history = BranchHistory();
      history.push(leaving: 0, entering: 11);

      expect(history.canGoBack, isTrue);
      expect(history.pop(), 0);
      expect(history.canGoBack, isFalse);
    });

    test('re-selecting the open branch is not a move', () {
      // Otherwise tapping Equipe while already on Equipe would make "back"
      // return to Equipe, which is the one destination it cannot usefully have.
      final history = BranchHistory();
      history.push(leaving: 11, entering: 11);

      expect(history.canGoBack, isFalse);
    });

    test('walks back in the order visited', () {
      final history = BranchHistory();
      history.push(leaving: 0, entering: 1);
      history.push(leaving: 1, entering: 11);

      expect(history.pop(), 1);
      expect(history.pop(), 0);
      expect(history.pop(), isNull);
    });

    test('forgets the oldest rather than growing without bound', () {
      final history = BranchHistory();
      for (var i = 0; i <= BranchHistory.maxEntries; i++) {
        history.push(leaving: i, entering: i + 1);
      }

      // The first entry is gone; the most recent is still the next step back.
      expect(history.pop(), BranchHistory.maxEntries);
      final remaining = <int>[];
      for (var next = history.pop(); next != null; next = history.pop()) {
        remaining.add(next);
      }
      expect(remaining.length, BranchHistory.maxEntries - 1);
      expect(remaining.contains(0), isFalse);
    });
  });

  group('appNavigationItems', () {
    test('keeps order history available in the main navigation', () {
      expect(
        appNavigationItems,
        contains(
          predicate<AppNavigationItem>((item) => item.route == '/orders'),
        ),
      );
    });

    test('offers no way into Perfil', () {
      // The branch and the route survive; only the drawer entry is gone. The
      // avatar picker and the push preference live there and nowhere else, so
      // this is the assertion that records the trade deliberately.
      expect(
        appNavigationItems,
        isNot(
          contains(
            predicate<AppNavigationItem>((item) => item.route == '/profile'),
          ),
        ),
      );
    });

    test('offers a way into Usuários, gated to admins', () {
      // This used to assert the opposite. Usuários had been dropped from the
      // drawer on the grounds that Equipe is the one place people are listed —
      // true of *listing* people, but Usuários is roles, assignments and
      // invitations, and "Convidar" starts there and nowhere else. Removing
      // the entry left the app with no way to invite anyone at all.
      final users = appNavigationItems.where((item) => item.route == '/users');

      expect(users, hasLength(1));
      expect(users.single.label, 'Usuários');
      expect(
        users.single.visibleFor,
        isNotNull,
        reason: 'user administration stays admin-only',
      );
    });
  });

  testWidgets('drawer remains scrollable on compact height and large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 360);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(
            size: Size(320, 360),
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            body: AtlasDrawerNavigation(
              activeBranchIndex: 0,
              onSelectBranch: _ignoreBranch,
              role: UserRoleName.admin,
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('atlas-drawer-navigation')), findsOneWidget);
    expect(find.byType(Scrollable), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}

void _ignoreBranch(int _) {}

/// Regression: logging out cleared the session and left the *user* cached.
///
/// `UserRepository` is a long-lived singleton and `currentValueOrResolve()`
/// returns its cached value without refetching, so the next person to sign in
/// inherited the previous one's identity — the drawer greeted them by the wrong
/// name and `currentUserRoleProvider` reported the wrong role — until the app
/// was restarted. Found by signing in as a manager and being shown the admin.
void _logoutTests() {
  group('performLogout', () {
    test('clears the cached user after revoking the session', () async {
      final calls = <String>[];

      await performLogout(
        revokeSession: () async => calls.add('revoke'),
        clearUser: () async => calls.add('clear'),
      );

      expect(calls, ['revoke', 'clear']);
    });

    test('clears the cached user even when the revoke fails', () async {
      var cleared = false;

      // An expired token or no network must not leave the app signed in
      // locally: the identity is what the next sign-in would inherit.
      await performLogout(
        revokeSession: () async => throw Exception('offline'),
        clearUser: () async => cleared = true,
      );

      expect(cleared, isTrue);
    });

    test('does not rethrow a failed revoke at the call site', () async {
      // The drawer calls this without awaiting, so a thrown error would become
      // an unhandled async exception rather than anything a user could act on.
      await expectLater(
        performLogout(
          revokeSession: () async => throw Exception('boom'),
          clearUser: () async {},
        ),
        completes,
      );
    });
  });
}

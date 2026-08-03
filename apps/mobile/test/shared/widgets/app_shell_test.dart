import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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
      expect(
        appNavigationItems
            .singleWhere((item) => item.route == '/profile')
            .branchIndex,
        10,
      );
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

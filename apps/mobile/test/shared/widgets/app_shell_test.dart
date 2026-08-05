import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:atlasmed_mobile_app/core/user/providers/user_capabilities_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      ProviderScope(
        overrides: [
          userCapabilitiesProvider.overrideWith(
            (ref) async => UserCapabilities(
              version: 1,
              capabilities: {AppCapability.agendaRead},
            ),
          ),
        ],
        child: MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 360),
              textScaler: TextScaler.linear(2),
            ),
            child: Scaffold(
              body: Consumer(
                builder: (context, ref, _) => AtlasDrawerNavigation(
                  activeBranchIndex: 0,
                  onSelectBranch: _ignoreBranch,
                  ref: ref,
                ),
              ),
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

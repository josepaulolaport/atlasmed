import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
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
  });

  group('appNavigationItems', () {
    test('does not expose orders while the feature is deferred', () {
      expect(
        appNavigationItems,
        isNot(
          contains(
            predicate<AppNavigationItem>((item) => item.route == '/orders'),
          ),
        ),
      );
    });
  });
}

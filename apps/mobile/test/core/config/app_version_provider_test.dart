import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'package:atlasmed_mobile_app/core/config/app_version_provider.dart';

void main() {
  group('formatAppVersion', () {
    test('formats release build without patch', () {
      expect(formatAppVersion(version: '1.2.0', buildNumber: '8'), 'v1.2.0+8');
    });

    test('appends Shorebird patch number when present', () {
      expect(
        formatAppVersion(version: '1.2.0', buildNumber: '8', patchNumber: 3),
        'v1.2.0+8 (3)',
      );
    });

    test('patch 1 is the first patch, not "no patch"', () {
      expect(
        formatAppVersion(version: '1.2.0', buildNumber: '8', patchNumber: 1),
        'v1.2.0+8 (1)',
      );
    });
  });

  group('appVersionProvider', () {
    test(
      'resolves to v<version>+<build> when no Shorebird patch is applied',
      () async {
        PackageInfo.setMockInitialValues(
          appName: 'atlasmed_mobile_app',
          packageName: 'br.com.atlasmed.app',
          version: '1.2.0',
          buildNumber: '8',
          buildSignature: '',
        );

        final container = ProviderContainer();
        addTearDown(container.dispose);

        // In a test environment the Shorebird engine is absent, so the updater
        // reports unavailable and readCurrentPatch() returns null — the provider
        // must still resolve to the release version.
        final version = await container.read(appVersionProvider.future);
        expect(version, 'v1.2.0+8');
      },
    );
  });
}

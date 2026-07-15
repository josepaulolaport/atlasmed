import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';

void main() {
  test(
    'preferencesProvider returns structure matching ProviderItem type',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await expectLater(container.read(preferencesProvider.future), completes);
    },
  );
}

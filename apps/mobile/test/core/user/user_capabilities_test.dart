import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('decodes typed resource actions and ignores unknown values', () {
    final capabilities = UserCapabilities.fromJson({
      'version': 2,
      'capabilities': [
        {
          'resource': 'agenda',
          'actions': ['read', 'unknown.future.action'],
        },
        {
          'resource': 'unknown.future.resource',
          'actions': ['read'],
        },
        {
          'resource': 'facility',
          'actions': ['update'],
        },
      ],
    });

    expect(capabilities.version, 2);
    expect(capabilities.can(.read, .agenda), isTrue);
    expect(capabilities.can(.update, .facility), isTrue);
    expect(capabilities.capabilities.length, 2);
  });
}

import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses person as the capability resource wire name', () {
    expect(CapabilityResource.person.wireName, 'person');
    expect(CapabilityResourceX.tryParse('person'), CapabilityResource.person);
    expect(CapabilityResourceX.tryParse('professional'), isNull);
  });

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
          'resource': 'person',
          'actions': ['update'],
        },
      ],
    });

    expect(capabilities.version, 2);
    expect(capabilities.can(.read, .agenda), isTrue);
    expect(capabilities.can(.update, .person), isTrue);
    expect(capabilities.capabilities.length, 2);
  });
}

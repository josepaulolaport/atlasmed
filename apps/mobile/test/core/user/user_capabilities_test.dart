import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ignores unknown capabilities while parsing', () {
    final capabilities = UserCapabilities.fromJson({
      'version': 1,
      'capabilities': [
        'agenda.read',
        'unknown.future.capability',
        'facility.update',
      ],
    });

    expect(capabilities.version, 1);
    expect(capabilities.can(AppCapability.agendaRead), isTrue);
    expect(capabilities.can(AppCapability.facilityUpdate), isTrue);
    expect(capabilities.capabilities.length, 2);
  });
}

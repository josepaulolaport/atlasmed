import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes scalar user fields from access responses', () {
    final user = AppUser.fromJson({
      'id': '7',
      'firstName': 123,
      'lastName': 'Silva',
      'role': {'name': 'MANAGER'},
      'status': 1,
    });

    expect(user.id, 7);
    expect(user.name, '123 Silva');
    expect(user.role, UserRole.manager);
    expect(user.isActive, isFalse);
  });
}

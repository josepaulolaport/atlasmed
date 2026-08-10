import 'package:atlasmed_mobile_app/features/profile/data/user_assignments.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the API verticalAssignments contract', () {
    final assignments = UserAssignments.fromJson({
      'userId': 7,
      'isOperationallyActive': true,
      'verticalAssignments': [
        {
          'verticalId': 3,
          'verticalName': 'Cardiologia',
          'managers': const [],
          'territories': const [],
        },
      ],
    });

    expect(assignments.userId, 7);
    expect(assignments.isOperationallyActive, isTrue);
    expect(assignments.verticals.single.verticalId, 3);
  });
}

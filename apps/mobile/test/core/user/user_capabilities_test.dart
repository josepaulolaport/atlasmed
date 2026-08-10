import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  UserCapabilities decode(List<Map<String, Object?>> rules) =>
      UserCapabilities.fromJson({'version': 2, 'capabilities': rules});

  test('uses exact backend CASL wire vocabulary', () {
    expect(CapabilitySubject.calendar.wireName, 'CALENDAR');
    expect(CapabilitySubject.person.wireName, 'PERSON');
    expect(CapabilitySubjectX.tryParse('PROFESSIONAL'), isNull);
    expect(CapabilityAction.update.wireName, 'update');
  });

  test('allows an exact action and subject match', () {
    final capabilities = decode([
      {'action': 'read', 'subject': 'CALENDAR'},
    ]);

    expect(capabilities.can(.read, .calendar), isTrue);
  });

  test('treats manage as an action wildcard for an exact subject', () {
    final capabilities = decode([
      {'action': 'manage', 'subject': 'USER'},
    ]);

    expect(capabilities.can(.update, .user), isTrue);
  });

  test('lets a later inverted denial override an earlier manage rule', () {
    final capabilities = decode([
      {'action': 'manage', 'subject': 'USER'},
      {'action': 'update', 'subject': 'USER', 'inverted': true},
    ]);

    expect(capabilities.can(.update, .user), isFalse);
    expect(capabilities.can(.read, .user), isTrue);
  });

  test('lets a later allow override an earlier denial', () {
    final capabilities = decode([
      {'action': 'read', 'subject': 'PERSON', 'inverted': true},
      {'action': 'read', 'subject': 'PERSON'},
    ]);

    expect(capabilities.can(.read, .person), isTrue);
  });

  test('ignores unknown actions and subjects safely', () {
    final capabilities = decode([
      {'action': 'future', 'subject': 'USER'},
      {'action': 'read', 'subject': 'FUTURE_SUBJECT'},
      {'action': 'read', 'subject': 'PERSON'},
    ]);

    expect(capabilities.can(.read, .person), isTrue);
    expect(capabilities.rules, hasLength(1));
  });

  test('denies when no rule matches', () {
    final capabilities = decode([
      {'action': 'read', 'subject': 'PERSON'},
    ]);

    expect(capabilities.can(.update, .person), isFalse);
    expect(capabilities.can(.read, .user), isFalse);
  });
}

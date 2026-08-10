enum CapabilitySubject {
  calendar,
  catalog,
  cadastroSubmission,
  fieldSuggestion,
  facility,
  person,
  territory,
  user,
  visit,
}

enum CapabilityAction { read, create, update, delete, manage }

extension CapabilitySubjectX on CapabilitySubject {
  String get wireName => switch (this) {
    .calendar => 'CALENDAR',
    .catalog => 'CATALOG',
    .cadastroSubmission => 'CADASTRO_SUBMISSION',
    .fieldSuggestion => 'FIELD_SUGGESTION',
    .facility => 'FACILITY',
    .person => 'PERSON',
    .territory => 'TERRITORY',
    .user => 'USER',
    .visit => 'VISIT',
  };

  static CapabilitySubject? tryParse(String value) {
    for (final subject in CapabilitySubject.values) {
      if (subject.wireName == value) return subject;
    }
    return null;
  }
}

extension CapabilityActionX on CapabilityAction {
  String get wireName => name;

  static CapabilityAction? tryParse(String value) {
    for (final action in CapabilityAction.values) {
      if (action.wireName == value) return action;
    }
    return null;
  }
}

class CapabilityRule {
  const CapabilityRule({
    required this.action,
    required this.subject,
    this.inverted = false,
  });

  final CapabilityAction action;
  final CapabilitySubject subject;
  final bool inverted;
}

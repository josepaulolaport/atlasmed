import 'app_capability.dart';

class UserCapabilities {
  const UserCapabilities({required this.version, required this.rules});

  final int version;
  final List<CapabilityRule> rules;

  bool can(CapabilityAction action, CapabilitySubject subject) {
    for (final rule in rules.reversed) {
      if (rule.subject != subject) continue;
      if (rule.action != action && rule.action != CapabilityAction.manage) {
        continue;
      }
      return !rule.inverted;
    }
    return false;
  }

  factory UserCapabilities.fromJson(Map<String, dynamic> json) {
    final parsed = <CapabilityRule>[];
    for (final raw in (json['capabilities'] as List? ?? const [])) {
      if (raw is! Map) continue;
      final action = CapabilityActionX.tryParse(
        raw['action']?.toString() ?? '',
      );
      final subject = CapabilitySubjectX.tryParse(
        raw['subject']?.toString() ?? '',
      );
      if (action == null || subject == null) continue;

      parsed.add(
        CapabilityRule(
          action: action,
          subject: subject,
          inverted: raw['inverted'] == true,
        ),
      );
    }
    return UserCapabilities(
      version: (json['version'] as num?)?.toInt() ?? 1,
      rules: parsed,
    );
  }
}

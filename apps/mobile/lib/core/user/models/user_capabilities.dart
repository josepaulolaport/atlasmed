import 'app_capability.dart';

class UserCapabilities {
  const UserCapabilities({required this.version, required this.capabilities});

  final int version;
  final Map<CapabilityResource, Set<CapabilityAction>> capabilities;

  bool can(CapabilityAction action, CapabilityResource resource) =>
      capabilities[resource]?.contains(action) ?? false;

  factory UserCapabilities.fromJson(Map<String, dynamic> json) {
    final parsed = <CapabilityResource, Set<CapabilityAction>>{};
    for (final raw in (json['capabilities'] as List? ?? const [])) {
      if (raw is! Map) continue;
      final resource = CapabilityResourceX.tryParse(
        raw['resource']?.toString() ?? '',
      );
      if (resource == null) continue;

      final actions = <CapabilityAction>{};
      for (final rawAction in (raw['actions'] as List? ?? const [])) {
        final action = AppCapabilityActionX.tryParse(rawAction.toString());
        if (action != null) actions.add(action);
      }
      if (actions.isNotEmpty) parsed[resource] = actions;
    }
    return UserCapabilities(
      version: (json['version'] as num?)?.toInt() ?? 1,
      capabilities: parsed,
    );
  }
}

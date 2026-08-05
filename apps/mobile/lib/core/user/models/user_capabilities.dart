import 'app_capability.dart';

class UserCapabilities {
  const UserCapabilities({required this.version, required this.capabilities});

  final int version;
  final Set<AppCapability> capabilities;

  bool can(AppCapability capability) => capabilities.contains(capability);

  factory UserCapabilities.fromJson(Map<String, dynamic> json) {
    final parsed = <AppCapability>{};
    for (final raw in (json['capabilities'] as List? ?? const [])) {
      final capability = AppCapabilityX.tryParse(raw.toString());
      if (capability != null) parsed.add(capability);
    }
    return UserCapabilities(
      version: (json['version'] as num?)?.toInt() ?? 1,
      capabilities: parsed,
    );
  }
}

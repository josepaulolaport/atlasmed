import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/providers/user_capabilities_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Can extends ConsumerWidget {
  final CapabilitySubject subject;
  final CapabilityAction action;

  final Widget? Function(BuildContext context, bool allowed) builder;

  const Can({
    super.key,
    required this.subject,
    required this.action,
    required this.builder,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final capabilities = ref.watch(userCapabilitiesProvider);

    return builder(context, capabilities?.can(action, subject) ?? false) ??
        const SizedBox.shrink();
  }
}

import 'package:atlasmed_mobile_app/core/user/models/app_capability.dart';
import 'package:atlasmed_mobile_app/core/user/providers/user_capabilities_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_screen.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/calendar_editor_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AgendaRouteGuard extends ConsumerWidget {
  const AgendaRouteGuard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final capabilities = ref.watch(userCapabilitiesProvider);

    return capabilities.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      data: (data) {
        if (data == null || !data.can(AppCapability.agendaRead)) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return const AgendaScreen();
      },
    );
  }
}

class AgendaEditorRouteGuard extends ConsumerWidget {
  const AgendaEditorRouteGuard({super.key, required this.target});

  final CalendarEditorTarget target;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final capabilities = ref.watch(userCapabilitiesProvider);
    return capabilities.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      data: (data) {
        if (data == null || !data.can(AppCapability.agendaCreate)) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return CalendarEditorScreen(target: target);
      },
    );
  }
}

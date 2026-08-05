import 'package:atlasmed_mobile_app/core/user/providers/user_capabilities_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_screen.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/calendar_editor_screen.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AgendaRouteGuard extends ConsumerWidget {
  const AgendaRouteGuard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.watch(userCapabilitiesRepositoryProvider);

    return RepositoryBuilder(
      repository: repository,
      builder: (context, data, actions) {
        if (data == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (!data.can(.read, .agenda)) {
          return const Scaffold(
            body: Center(
              child: Text('You are not authorized to access the agenda'),
            ),
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
    final repository = ref.watch(userCapabilitiesRepositoryProvider);

    return RepositoryBuilder(
      repository: repository,
      builder: (context, data, actions) {
        if (data == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (!data.can(.create, .agenda)) {
          return const Scaffold(
            body: Center(
              child: Text('You are not authorized to access the agenda'),
            ),
          );
        }

        return CalendarEditorScreen(target: target);
      },
    );
  }
}

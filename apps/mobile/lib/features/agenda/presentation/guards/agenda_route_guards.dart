import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
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
    final repository = ref.watch(userProvider);

    return RepositoryBuilder(
      repository: repository,
      builder: (context, data, actions) {
        if (data == null) {
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
    final repository = ref.watch(userProvider);

    return RepositoryBuilder(
      repository: repository,
      builder: (context, data, actions) {
        if (data == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return CalendarEditorScreen(target: target);
      },
    );
  }
}

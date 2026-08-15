import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
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

/// Opens an existing appointment for editing, fetching it when needed.
///
/// The occurrence normally travels from the agenda as `extra`, which costs no
/// request. It does not always arrive: the router refreshes on
/// `sessionListenable`, and a refresh rebuilds the matches from the location
/// alone, dropping `extra` — the screen then had nothing to edit and said
/// "Não foi possível abrir este compromisso", mid-edit, over a form the user
/// had already filled. The recurrence key is in the URL and carries the local
/// date, so the appointment can be found again by listing that day.
class AgendaOccurrenceEditorGuard extends ConsumerWidget {
  const AgendaOccurrenceEditorGuard({
    super.key,
    required this.calendarId,
    required this.recurrenceKey,
    required this.mode,
    this.occurrence,
  });

  final int calendarId;
  final String? recurrenceKey;
  final CalendarEditorMode mode;
  final CalendarOccurrence? occurrence;

  CalendarEditorTarget _targetFor(CalendarOccurrence value) =>
      mode == CalendarEditorMode.series
      ? CalendarEditorTarget.editingSeries(value)
      : CalendarEditorTarget.editingOccurrence(value);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final passed = occurrence;
    if (passed != null) {
      return AgendaEditorRouteGuard(target: _targetFor(passed));
    }

    final key = recurrenceKey;
    final day = key == null ? null : recurrenceKeyLocalDate(key);
    if (day == null) {
      return const _AgendaEditorUnavailable(
        message: 'Não foi possível abrir este compromisso.',
      );
    }

    // A day either side of it: the key's zone is the appointment's, not
    // necessarily the device's, so the local window can sit a few hours off.
    final query = AgendaQuery(
      from: day.subtract(const Duration(days: 1)),
      to: day.add(const Duration(days: 2)),
    );

    return ref
        .watch(agendaProvider(query))
        .when(
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (_, _) => _AgendaEditorUnavailable(
            message: 'Não foi possível carregar este compromisso.',
            onRetry: () => ref.invalidate(agendaProvider(query)),
          ),
          data: (occurrences) {
            final match = occurrences
                .where(
                  (item) =>
                      item.calendarId == calendarId &&
                      item.recurrenceKey == key,
                )
                .firstOrNull;
            if (match == null) {
              return const _AgendaEditorUnavailable(
                message: 'Este compromisso não está mais disponível.',
              );
            }
            return AgendaEditorRouteGuard(target: _targetFor(match));
          },
        );
  }
}

/// The local date inside a recurrence key such as
/// `2026-08-15T14:30[America/Sao_Paulo]`, or null if it is not one.
DateTime? recurrenceKeyLocalDate(String recurrenceKey) {
  final datePart = recurrenceKey.split('T').first;
  final parsed = DateTime.tryParse(datePart);
  if (parsed == null) return null;
  return DateTime(parsed.year, parsed.month, parsed.day);
}

class _AgendaEditorUnavailable extends StatelessWidget {
  const _AgendaEditorUnavailable({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Tentar novamente'),
              ),
            ],
          ],
        ),
      ),
    ),
  );
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

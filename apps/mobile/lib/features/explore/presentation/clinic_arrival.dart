import 'dart:async';
import 'dart:math';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Records arriving at a clinic, right now — spec 0016 §15.6.3.
///
/// One press and nothing else (§15.6.1). No confirmation dialog: every question
/// asked here is friction on the one loop that has never yet run, and the visit
/// is recoverable — the snackbar opens it, and the rep can complete or correct
/// it there. An arrival left running is closed by the next one or by the
/// workday-end job.
///
/// Not the same button as *Visita*, which schedules. This one says the rep is
/// standing in the clinic now, which is a different sentence and a different
/// record.
Future<void> recordClinicArrival(
  BuildContext context,
  WidgetRef ref, {
  required int facilityId,
  required String facilityName,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  final repository = ref.read(calendarRepositoryProvider);
  final queue = ref.read(captureQueueProvider);

  // Stamped before the request, not after it. §15.6.6-4: this is the instant
  // the rep pressed, and it is what gets sent whether the request goes now or
  // out of a queue tomorrow morning.
  final pressedAt = DateTime.now();
  // The same resolver the calendar editor uses, so an arrival and a scheduled
  // visit are anchored against one clock.
  final timeZone = resolveDeviceCalendarTimeZone(pressedAt);

  try {
    final interaction = await repository.recordArrival(
      facilityId: facilityId,
      timeZone: timeZone,
      idempotencyKey: _arrivalKey(),
      startedAt: pressedAt.toUtc().toIso8601String(),
    );
    if (!context.mounted) return;

    // Today's agenda now holds a visit it did not a moment ago.
    ref.invalidate(calendarRepositoryProvider);
    // Signal is back, so anything waiting can go now.
    unawaited(queue.drain());

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          // `SnackBar.persist` defaults to `action != null`, and the dismiss
          // timer returns early when it is set — so a snackbar with an action
          // stays on screen for ever unless something else replaces it. Ours
          // sat over the clinic list until the next press. Long enough to read
          // and reach "Abrir", then gone.
          persist: false,
          duration: const Duration(seconds: 6),
          content: Text('Visita iniciada em $facilityName'),
          action: SnackBarAction(
            // The way back from a mistaken press, and the way to finish the
            // visit deliberately rather than waiting to be closed.
            label: 'Abrir',
            onPressed: () =>
                InteractionDetailRoute(id: interaction.id).push(context),
          ),
        ),
      );
  } on CalendarNetworkException {
    // The case this whole feature exists for: a clinic with no signal. The
    // press is kept with the instant it happened and sent when there is a
    // network, so the visit is recorded as having started here rather than
    // wherever the rep was when the bars came back.
    await queue.enqueue(
      kind: PendingCaptureKind.arrival,
      label: 'Cheguei · $facilityName',
      payload: {'facilityId': facilityId, 'timeZone': timeZone},
      stampedAt: pressedAt,
    );
    if (!context.mounted) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: const Text('Sem conexão. Visita guardada e será enviada.'),
        ),
      );
  } on CalendarApiException catch (error) {
    // The server answered and refused. Queuing would only refuse again later,
    // and the rep would be told twice about one mistake.
    if (!context.mounted) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(error.message),
        ),
      );
  }
}

/// Fresh per press, so two arrivals at the same clinic are two visits while a
/// retry of one press is not.
String _arrivalKey() {
  final random = Random.secure();
  return List<int>.generate(
    16,
    (_) => random.nextInt(256),
  ).map((value) => value.toRadixString(16).padLeft(2, '0')).join();
}

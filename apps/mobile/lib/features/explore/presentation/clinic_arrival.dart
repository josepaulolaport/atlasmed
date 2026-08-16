import 'dart:math';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
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

  try {
    final interaction = await repository.recordArrival(
      facilityId: facilityId,
      // The same resolver the calendar editor uses, so an arrival and a
      // scheduled visit are anchored against one clock.
      timeZone: resolveDeviceCalendarTimeZone(DateTime.now()),
      idempotencyKey: _arrivalKey(),
    );
    if (!context.mounted) return;

    // Today's agenda now holds a visit it did not a moment ago.
    ref.invalidate(calendarRepositoryProvider);

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
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
  } on CalendarApiException catch (error) {
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

import 'dart:async';
import 'dart:math';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Starting and ending a *planned* visit, from wherever the rep is looking.
///
/// Distinct from `recordClinicArrival`, which invents a visit the roteiro never
/// suggested. Here the appointment already exists and carries an interaction,
/// so this is `start` / `complete` — but the rest is the same contract: stamp
/// before the request (§15.6.6-4), and hand the press to the queue when the
/// network is what failed rather than losing it.
///
/// Lives outside any one screen because the same press belongs on the agenda,
/// on Desempenho, and anywhere else the day is shown. A rep should not have to
/// find a clinic profile to say they have arrived somewhere they planned.
Future<bool> startPlannedVisit(
  BuildContext context,
  WidgetRef ref, {
  required int interactionId,
  required int expectedVersion,
  required String facilityName,
}) => _run(
  context,
  ref,
  kind: PendingCaptureKind.start,
  label: 'Iniciar · $facilityName',
  payload: {'interactionId': interactionId, 'expectedVersion': expectedVersion},
  onlineMessage: 'Visita iniciada em $facilityName',
  call: (repository, stampedAt) => repository.startInteraction(
    interactionId,
    expectedVersion: expectedVersion,
    idempotencyKey: _mintKey(),
    startedAt: stampedAt,
  ),
);

Future<bool> finishPlannedVisit(
  BuildContext context,
  WidgetRef ref, {
  required int interactionId,
  required int expectedVersion,
  required String facilityName,
}) => _run(
  context,
  ref,
  kind: PendingCaptureKind.complete,
  label: 'Encerrar · $facilityName',
  payload: {'interactionId': interactionId, 'expectedVersion': expectedVersion},
  onlineMessage: 'Visita encerrada em $facilityName',
  call: (repository, stampedAt) => repository.completeInteraction(
    interactionId,
    expectedVersion: expectedVersion,
    idempotencyKey: _mintKey(),
    completedAt: stampedAt,
  ),
);

Future<bool> _run(
  BuildContext context,
  WidgetRef ref, {
  required PendingCaptureKind kind,
  required String label,
  required Map<String, dynamic> payload,
  required String onlineMessage,
  required Future<void> Function(
    CalendarRepositoryContract repository,
    String stampedAt,
  )
  call,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  final repository = ref.read(calendarRepositoryProvider);
  final queue = ref.read(captureQueueProvider);

  // The instant the rep pressed, not the instant the request landed.
  final pressedAt = DateTime.now().toUtc();

  try {
    await call(repository, pressedAt.toIso8601String());
    if (!context.mounted) return true;
    ref.invalidate(calendarRepositoryProvider);
    unawaited(queue.drain());
    _say(messenger, onlineMessage);
    return true;
  } on CalendarNetworkException {
    await queue.enqueue(
      kind: kind,
      label: label,
      payload: payload,
      stampedAt: pressedAt,
    );
    if (!context.mounted) return false;
    _say(messenger, 'Sem conexão. Guardado e será enviado.');
    return false;
  } on CalendarApiException catch (error) {
    // The server answered and refused — a stale version, a visit already
    // started elsewhere. Queuing would only refuse again later.
    if (!context.mounted) return false;
    _say(messenger, error.message);
    return false;
  }
}

void _say(ScaffoldMessengerState messenger, String message) {
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(behavior: SnackBarBehavior.floating, content: Text(message)),
    );
}

String _mintKey() {
  final random = Random.secure();
  return List<int>.generate(
    16,
    (_) => random.nextInt(256),
  ).map((value) => value.toRadixString(16).padLeft(2, '0')).join();
}

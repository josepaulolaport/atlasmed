import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/capture/data/capture_queue.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class InteractionState {
  const InteractionState({
    this.detail = const AsyncLoading(),
    this.commandInProgress,
    this.commandError,
  });

  final AsyncValue<InteractionDetail> detail;
  final String? commandInProgress;
  final String? commandError;

  InteractionState copyWith({
    AsyncValue<InteractionDetail>? detail,
    String? commandInProgress,
    String? commandError,
    bool clearCommand = false,
    bool clearError = false,
  }) => InteractionState(
    detail: detail ?? this.detail,
    commandInProgress: clearCommand
        ? null
        : (commandInProgress ?? this.commandInProgress),
    commandError: clearError ? null : (commandError ?? this.commandError),
  );
}

class InteractionNotifier extends StateNotifier<InteractionState>
    with DisposeSafeStateWrites<InteractionState> {
  InteractionNotifier(
    this._repository,
    this.interactionId, {
    CaptureQueue? queue,
  }) : _queue = queue,
       super(const InteractionState()) {
    load();
  }

  final CalendarRepositoryContract _repository;

  /// Where a press goes when there is no signal — §15.6.6-4. Nullable so the
  /// notifier can still be built in tests that are not about the queue.
  final CaptureQueue? _queue;
  final int interactionId;
  final Map<String, String> _commandKeys = {};

  Future<void> load() async {
    state = state.copyWith(
      detail: const AsyncLoading(),
      clearError: true,
      clearCommand: true,
    );
    try {
      state = state.copyWith(
        detail: AsyncData(await _repository.getInteraction(interactionId)),
      );
    } catch (error, stackTrace) {
      state = state.copyWith(detail: AsyncError(error, stackTrace));
    }
  }

  /// Records the two questions — spec 0016 §15.6.4.
  ///
  /// Deliberately not part of the complete command: most visits are closed by
  /// the next arrival or by the workday-end job, so the answers arrive when the
  /// visit is already COMPLETED and there is no command to carry them.
  Future<bool> recordOutcome({
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) async {
    try {
      final updated = await _repository.recordInteractionOutcome(
        interactionId,
        outcome: outcome,
        followUp: followUp,
      );
      state = state.copyWith(detail: AsyncData(updated), clearError: true);
      return true;
    } catch (error) {
      state = state.copyWith(commandError: interactionErrorMessage(error));
      return false;
    }
  }

  Future<bool> start() => _runCommand('start');

  Future<bool> complete({String? correctionReason}) =>
      _runCommand('complete', correctionReason: correctionReason);

  Future<bool> _runCommand(String command, {String? correctionReason}) async {
    final detail = state.detail.asData?.value;
    if (detail == null || state.commandInProgress != null) return false;
    final keySlot = '$command:${detail.version}';
    final idempotencyKey = _commandKeys.putIfAbsent(
      keySlot,
      () => '$command-$interactionId-v${detail.version}',
    );
    // Stamped before the request (§15.6.6-4). This is the instant the rep
    // pressed, and it is what gets sent whether the request goes now or out of
    // the queue tomorrow morning.
    final pressedAt = DateTime.now().toUtc();
    state = state.copyWith(commandInProgress: command, clearError: true);
    try {
      if (command == 'start') {
        await _repository.startInteraction(
          interactionId,
          expectedVersion: detail.version,
          idempotencyKey: idempotencyKey,
          startedAt: pressedAt.toIso8601String(),
        );
      } else {
        await _repository.completeInteraction(
          interactionId,
          expectedVersion: detail.version,
          idempotencyKey: idempotencyKey,
          correctionReason: correctionReason,
          completedAt: pressedAt.toIso8601String(),
        );
      }
      final refreshed = await _repository.getInteraction(interactionId);
      _commandKeys.remove(keySlot);
      state = state.copyWith(
        detail: AsyncData(refreshed),
        clearCommand: true,
        clearError: true,
      );
      return true;
    } on CalendarNetworkException {
      // The press is a fact the rep witnessed; the network is not their
      // problem. Kept with the instant it happened and sent when there is one.
      await _queue?.enqueue(
        kind: command == 'start'
            ? PendingCaptureKind.start
            : PendingCaptureKind.complete,
        label: command == 'start'
            ? 'Iniciar · ${_subjectLabel(detail)}'
            : 'Encerrar · ${_subjectLabel(detail)}',
        payload: {
          'interactionId': interactionId,
          'expectedVersion': detail.version,
          if (correctionReason != null && correctionReason.trim().isNotEmpty)
            'correctionReason': correctionReason.trim(),
        },
        stampedAt: pressedAt,
      );
      state = state.copyWith(
        commandError: _queue == null
            ? 'Não foi possível concluir a ação. Verifique sua conexão e tente novamente.'
            : 'Sem conexão. Guardado e será enviado.',
        clearCommand: true,
      );
      return false;
    } catch (error) {
      state = state.copyWith(
        commandError: interactionErrorMessage(error),
        clearCommand: true,
      );
      return false;
    }
  }
}

/// What the queued press is *about*, for the banner the rep reads offline.
///
/// The clinic where there is one; otherwise the doctor, since a contact with a
/// doctor may have happened nowhere (§15.7.5). "Iniciar · Atendimento" would
/// tell them nothing about which of two waiting entries this is.
String _subjectLabel(InteractionDetail detail) =>
    detail.facility?.displayName ?? detail.person?.name ?? detail.title;

String interactionErrorMessage(Object error) {
  if (error is InteractionVersionConflictException) {
    return 'Este atendimento foi atualizado. Recarregue e tente novamente.';
  }
  if (error is InteractionTransitionException) {
    return 'Esta ação não está mais disponível para o status atual.';
  }
  if (error is CalendarForbiddenException) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (error is CalendarValidationException) {
    return error.message;
  }
  if (error is CalendarNetworkException) {
    return 'Não foi possível concluir a ação. Verifique sua conexão e tente novamente.';
  }
  if (error is CalendarApiException) return error.message;
  return 'Não foi possível concluir a ação. Tente novamente.';
}

final interactionProvider = StateNotifierProvider.autoDispose
    .family<InteractionNotifier, InteractionState, int>((ref, interactionId) {
      return InteractionNotifier(
        ref.watch(calendarRepositoryProvider),
        interactionId,
        // Read, not watch. The queue is a ChangeNotifier that notifies as soon
        // as it counts what is waiting, and watching it rebuilt this
        // autoDispose family — a fresh notifier, a second load(), and two GETs
        // for one screen. Nothing here needs to rebuild when the count moves.
        queue: ref.read(captureQueueProvider),
      );
    });

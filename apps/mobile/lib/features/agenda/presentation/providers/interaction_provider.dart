import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
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

class InteractionNotifier extends StateNotifier<InteractionState> {
  InteractionNotifier(this._repository, this.interactionId)
    : super(const InteractionState()) {
    load();
  }

  final CalendarRepositoryContract _repository;
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
    state = state.copyWith(commandInProgress: command, clearError: true);
    try {
      if (command == 'start') {
        await _repository.startInteraction(
          interactionId,
          expectedVersion: detail.version,
          idempotencyKey: idempotencyKey,
        );
      } else {
        await _repository.completeInteraction(
          interactionId,
          expectedVersion: detail.version,
          idempotencyKey: idempotencyKey,
          correctionReason: correctionReason,
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
    } catch (error) {
      state = state.copyWith(
        commandError: interactionErrorMessage(error),
        clearCommand: true,
      );
      return false;
    }
  }
}

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
      );
    });

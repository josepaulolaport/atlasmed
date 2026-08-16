import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/interaction_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/visit_outcome_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

class InteractionNotesQuery extends Equatable {
  const InteractionNotesQuery({required this.facilityId});

  final int facilityId;

  @override
  List<Object?> get props => [facilityId];
}

final interactionNotesRepositoryProvider = Provider.autoDispose
    .family<FacilityNotesRepository, InteractionNotesQuery>((ref, query) {
      final repository = FacilityNotesRepository(query.facilityId);
      ref.onDispose(repository.dispose);
      return repository;
    });

final interactionNotesProvider = FutureProvider.autoDispose
    .family<List<FacilityFieldNote>, InteractionNotesQuery>((ref, query) {
      return ref.watch(interactionNotesRepositoryProvider(query)).loadNotes();
    });

class InteractionScreen extends ConsumerWidget {
  const InteractionScreen({
    super.key,
    required this.interactionId,
    this.onReschedule,
    this.onCancel,
  });

  final int interactionId;
  final VoidCallback? onReschedule;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(interactionProvider(interactionId));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Interação'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
      ),
      body: state.detail.when(
        loading: () => const Center(
          child: CircularProgressIndicator(
            semanticsLabel: 'Carregando interação',
          ),
        ),
        error: (error, _) => _InteractionError(
          message: interactionErrorMessage(error),
          onRetry: () =>
              ref.read(interactionProvider(interactionId).notifier).load(),
        ),
        data: (detail) => _InteractionContent(
          detail: detail,
          command: state.commandInProgress,
          commandError: state.commandError,
          onStart: () =>
              ref.read(interactionProvider(interactionId).notifier).start(),
          onComplete: ({correctionReason}) async {
            final done = await ref
                .read(interactionProvider(interactionId).notifier)
                .complete(correctionReason: correctionReason);
            // Asked the moment the visit closes, while the rep still remembers
            // it (§15.6.4). Never blocking: the visit is already recorded.
            if (done && context.mounted) {
              await _askOutcome(ref, context, detail);
            }
            return done;
          },
          onAnswerOutcome: () => _askOutcome(ref, context, detail),
          onRefresh: () =>
              ref.read(interactionProvider(interactionId).notifier).load(),
          onReschedule:
              onReschedule ??
              () async {
                final occurrence = CalendarOccurrence.fromInteraction(detail);
                await AgendaOccurrenceEditRoute(
                  id: detail.calendarId,
                  recurrenceKey: detail.recurrenceKey,
                  $extra: occurrence,
                ).push(context);
                await ref
                    .read(interactionProvider(interactionId).notifier)
                    .load();
              },
          onCancel: onCancel ?? () => _cancelOccurrence(context, ref, detail),
        ),
      ),
    );
  }
}

Future<void> _cancelOccurrence(
  BuildContext context,
  WidgetRef ref,
  InteractionDetail detail,
) async {
  final controller = TextEditingController();
  String? errorText;
  final reason = await showDialog<String>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Cancelar interação'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Informe o motivo do cancelamento desta ocorrência.'),
            const SizedBox(height: 12),
            TextField(
              key: const Key('interaction-cancel-reason'),
              controller: controller,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Motivo',
                errorText: errorText,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Voltar'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.isEmpty) {
                setState(() => errorText = 'Informe o motivo do cancelamento.');
                return;
              }
              Navigator.pop(dialogContext, value);
            },
            child: const Text('Confirmar cancelamento'),
          ),
        ],
      ),
    ),
  );
  if (reason == null || !context.mounted) return;

  final repository = ref.read(calendarMutationRepositoryProvider);
  final expectedVersion = detail.overrideVersion ?? 0;
  final idempotencyKey =
      'cancel-${detail.calendarId}-${detail.recurrenceKey}-v$expectedVersion';
  try {
    await repository.cancelCalendarOccurrence(
      calendarId: detail.calendarId,
      recurrenceKey: detail.recurrenceKey,
      command: CalendarCancellationCommand(
        expectedVersion: expectedVersion,
        reason: reason,
      ),
      idempotencyKey: idempotencyKey,
    );
    ref.invalidate(agendaProvider);
    await ref.read(interactionProvider(detail.id).notifier).load();
  } on CalendarApiException catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(error.message)));
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Não foi possível cancelar a interação. Tente novamente.',
        ),
      ),
    );
  }
}

/// Puts the two questions on screen and stores whatever the rep taps.
///
/// Dismissing without answering is a legitimate outcome — unanswered is a state
/// the model carries, and a rep in a car park should be able to walk away.
Future<void> _askOutcome(
  WidgetRef ref,
  BuildContext context,
  InteractionDetail detail,
) async {
  final answers = await showVisitOutcomeSheet(
    context,
    facilityName: detail.facility.displayName,
  );
  if (answers == null) return;
  await ref
      .read(interactionProvider(detail.id).notifier)
      .recordOutcome(outcome: answers.outcome, followUp: answers.followUp);
}

class _InteractionContent extends ConsumerWidget {
  const _InteractionContent({
    required this.detail,
    required this.command,
    required this.commandError,
    required this.onStart,
    required this.onComplete,
    required this.onAnswerOutcome,
    required this.onRefresh,
    this.onReschedule,
    this.onCancel,
  });

  final InteractionDetail detail;
  final String? command;
  final String? commandError;
  final Future<bool> Function() onStart;
  final Future<bool> Function({String? correctionReason}) onComplete;

  /// Offered when a visit was closed for the rep — by an arrival or by the
  /// workday-end job — and nobody has answered the questions yet.
  final Future<void> Function() onAnswerOutcome;
  final Future<void> Function() onRefresh;
  final VoidCallback? onReschedule;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesQuery = InteractionNotesQuery(facilityId: detail.facility.id);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(interactionNotesProvider(notesQuery));
        await Future.wait([
          onRefresh(),
          ref.read(interactionNotesProvider(notesQuery).future),
        ]);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _SummaryCard(detail: detail),
          if (!detail.canMutate) ...[
            const SizedBox(height: 12),
            const _ReadOnlyBanner(),
          ],
          if (commandError != null) ...[
            const SizedBox(height: 12),
            _ErrorBanner(message: commandError!),
          ],
          const SizedBox(height: 16),
          _OrdersCard(detail: detail),
          const SizedBox(height: 16),
          _NotesCard(query: notesQuery, canAdd: detail.canMutate),
          if (detail.canMutate) ...[
            const SizedBox(height: 16),
            _ActionsCard(
              detail: detail,
              command: command,
              onStart: onStart,
              onComplete: onComplete,
              onAnswerOutcome: onAnswerOutcome,
              onReschedule: onReschedule,
              onCancel: onCancel,
            ),
          ],
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.detail});
  final InteractionDetail detail;

  @override
  Widget build(BuildContext context) {
    final start = detail.occurrenceStartsAt.toLocal();
    final end = detail.occurrenceEndsAt.toLocal();
    final measured = _measuredSpan(detail);
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.local_hospital_outlined,
                color: AppColors.navyDeep,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.facility.displayName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.gray900,
                      ),
                    ),
                    if (detail.facility.locationLabel.isNotEmpty)
                      Text(
                        detail.facility.locationLabel,
                        style: const TextStyle(color: AppColors.gray500),
                      ),
                  ],
                ),
              ),
              _StatusChip(status: detail.status),
            ],
          ),
          const Divider(height: 28),
          _InfoLine(
            icon: Icons.calendar_today_outlined,
            label: _dateLabel(start),
          ),
          const SizedBox(height: 8),
          // What the visit was, with what it was meant to be underneath.
          //
          // The screen showed only the plan, so a visit booked 08:00–09:00 that
          // ran 08:05–08:47 read as an hour on the one screen whose job is
          // saying what happened. The plan is not dropped — the gap between the
          // two is what P5 measures (§15.6.3) — it just stops being the headline
          // once there is a measurement to replace it.
          _InfoLine(
            icon: Icons.schedule_outlined,
            label: measured == null
                ? '${_timeLabel(start)}–${_timeLabel(end)}'
                : '${_timeLabel(measured.$1)}–${_timeLabel(measured.$2)}',
            note: measured == null
                ? null
                : 'previsto ${_timeLabel(start)}–${_timeLabel(end)}',
          ),
          const SizedBox(height: 8),
          _InfoLine(
            icon: detail.modality == CalendarModality.inPerson
                ? Icons.person_pin_circle_outlined
                : Icons.videocam_outlined,
            label: detail.modality == CalendarModality.inPerson
                ? 'Presencial'
                : 'Remoto',
          ),
          const SizedBox(height: 8),
          _InfoLine(
            icon: Icons.badge_outlined,
            label: detail.agent.displayName,
          ),
        ],
      ),
    );
  }
}

/// When the visit ran, if it has finished and both instants were recorded.
///
/// A close with no opening instant is an auto-closed visit the system never saw
/// start; there is nothing measured to show, so the plan stands.
(DateTime, DateTime)? _measuredSpan(InteractionDetail detail) {
  if (detail.status != InteractionStatus.completed) return null;
  final start = detail.actualStartedAt;
  final end = detail.actualEndedAt;
  if (start == null || end == null || !end.isAfter(start)) return null;
  return (start.toLocal(), end.toLocal());
}

class _OrdersCard extends StatelessWidget {
  const _OrdersCard({required this.detail});
  final InteractionDetail detail;

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Pedidos vinculados (${detail.linkedOrders.length})',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.gray900,
          ),
        ),
        const SizedBox(height: 10),
        if (detail.linkedOrders.isEmpty)
          const Text(
            'Nenhum pedido vinculado a este atendimento.',
            style: TextStyle(color: AppColors.gray500),
          )
        else
          for (final order in detail.linkedOrders)
            Material(
              color: Colors.transparent,
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.receipt_long_outlined),
                title: Text('${order.id}'),
                subtitle: Text(_orderStatusLabel(order.status)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => OrderDetailRoute(id: order.id).push(context),
              ),
            ),
      ],
    ),
  );
}

class _NotesCard extends ConsumerStatefulWidget {
  const _NotesCard({required this.query, required this.canAdd});
  final InteractionNotesQuery query;
  final bool canAdd;

  @override
  ConsumerState<_NotesCard> createState() => _NotesCardState();
}

class _NotesCardState extends ConsumerState<_NotesCard> {
  final _controller = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(interactionNotesProvider(widget.query));
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Notas da clínica',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 10),
          notes.when(
            loading: () => const LinearProgressIndicator(
              semanticsLabel: 'Carregando notas',
            ),
            error: (_, _) => TextButton(
              onPressed: () =>
                  ref.invalidate(interactionNotesProvider(widget.query)),
              child: const Text('Não foi possível carregar. Tentar novamente'),
            ),
            data: (items) => items.isEmpty
                ? const Text(
                    'Nenhuma nota registrada.',
                    style: TextStyle(color: AppColors.gray500),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final note in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text('• ${note.text}'),
                        ),
                    ],
                  ),
          ),
          if (widget.canAdd) ...[
            const Divider(height: 24),
            TextField(
              key: const Key('interaction-note-draft'),
              controller: _controller,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Nova nota',
                hintText: 'Registre um contexto importante da clínica',
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.redDark),
                ),
              ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.note_add_outlined),
              label: const Text('Adicionar nota'),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _save() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Digite uma nota antes de salvar.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(interactionNotesRepositoryProvider(widget.query))
          .createNote(text);
      _controller.clear();
      ref.invalidate(interactionNotesProvider(widget.query));
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Não foi possível salvar. O texto foi mantido para tentar novamente.',
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _ActionsCard extends StatelessWidget {
  const _ActionsCard({
    required this.detail,
    required this.command,
    required this.onStart,
    required this.onComplete,
    required this.onAnswerOutcome,
    this.onReschedule,
    this.onCancel,
  });

  final InteractionDetail detail;
  final String? command;
  final Future<bool> Function() onStart;
  final Future<bool> Function({String? correctionReason}) onComplete;

  /// Offered when a visit was closed for the rep — by an arrival or by the
  /// workday-end job — and nobody has answered the questions yet.
  final Future<void> Function() onAnswerOutcome;
  final VoidCallback? onReschedule;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final busy = command != null;
    final isRecurring = detail.recurrence != CalendarRecurrence.none;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (detail.status == InteractionStatus.scheduled)
            FilledButton.icon(
              onPressed: busy ? null : () => onStart(),
              icon: const Icon(Icons.play_arrow_rounded),
              label: Text(
                command == 'start' ? 'Iniciando…' : 'Iniciar interação',
              ),
            ),
          if (detail.status == InteractionStatus.inProgress)
            FilledButton.icon(
              onPressed: busy ? null : () => onComplete(),
              icon: const Icon(Icons.check_rounded),
              label: Text(
                command == 'complete' ? 'Concluindo…' : 'Concluir interação',
              ),
            ),
          // A visit closed by an arrival or by the workday-end job comes back
          // to a rep who never pressed anything. Asking here is the only way
          // those get answered at all (§15.6.4).
          if (detail.needsOutcome)
            OutlinedButton.icon(
              onPressed: busy ? null : () => onAnswerOutcome(),
              icon: const Icon(Icons.rate_review_outlined),
              label: const Text('Como foi a visita?'),
            ),
          if (detail.status == InteractionStatus.notCompleted)
            FilledButton.icon(
              onPressed: busy ? null : () => _showCorrectionDialog(context),
              icon: const Icon(Icons.fact_check_outlined),
              label: const Text('Corrigir como concluído'),
            ),
          // A "Novo pedido" action sat here. Creating an order is withdrawn
          // until an order belongs to an interaction — see the note in
          // router/routes.dart. Nothing routes to the order-creation screens.
          if (detail.status == InteractionStatus.scheduled &&
              (onReschedule != null || onCancel != null)) ...[
            const Divider(height: 24),
            if (onReschedule != null)
              TextButton.icon(
                onPressed: onReschedule,
                icon: const Icon(Icons.edit_calendar_outlined),
                label: Text(
                  isRecurring ? 'Reagendar esta ocorrência' : 'Reagendar',
                ),
              ),
            if (onCancel != null)
              TextButton.icon(
                onPressed: onCancel,
                icon: const Icon(Icons.event_busy_outlined),
                label: Text(
                  isRecurring
                      ? 'Cancelar esta ocorrência'
                      : 'Cancelar agendamento',
                ),
              ),
          ],
        ],
      ),
    );
  }

  Future<void> _showCorrectionDialog(BuildContext context) async {
    final controller = TextEditingController();
    String? error;
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Corrigir interação'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Informe por que esta interação deve ser marcada como concluída.',
              ),
              const SizedBox(height: 12),
              TextField(
                key: const Key('interaction-correction-reason'),
                controller: controller,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Justificativa',
                  errorText: error,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: () {
                final value = controller.text.trim();
                if (value.isEmpty) {
                  setState(
                    () => error = 'Informe a justificativa da correção.',
                  );
                  return;
                }
                Navigator.pop(dialogContext, value);
              },
              child: const Text('Confirmar correção'),
            ),
          ],
        ),
      ),
    );
    if (reason != null) await onComplete(correctionReason: reason);
  }
}

class _ReadOnlyBanner extends StatelessWidget {
  const _ReadOnlyBanner();
  @override
  Widget build(BuildContext context) => const _Card(
    child: Row(
      children: [
        Icon(Icons.visibility_outlined, color: AppColors.navyBright),
        SizedBox(width: 10),
        Expanded(
          child: Text(
            'Visualização somente leitura',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

class _InteractionError extends StatelessWidget {
  const _InteractionError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onRetry,
            child: const Text('Tentar novamente'),
          ),
        ],
      ),
    ),
  );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => _Card(
    child: Row(
      children: [
        const Icon(Icons.error_outline, color: AppColors.redDark),
        const SizedBox(width: 10),
        Expanded(child: Text(message)),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.gray200),
    ),
    child: child,
  );
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.label, this.note});
  final IconData icon;
  final String label;

  /// Quieter text under the line — the plan, once the measurement has taken
  /// the headline.
  final String? note;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 18, color: AppColors.gray500),
      const SizedBox(width: 8),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label),
            if (note case final text?)
              Text(
                text,
                style: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
              ),
          ],
        ),
      ),
    ],
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final InteractionStatus status;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: AppColors.blueLight,
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      _statusLabel(status),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.navyDeep,
      ),
    ),
  );
}

String _statusLabel(InteractionStatus status) => switch (status) {
  InteractionStatus.scheduled => 'Agendado',
  InteractionStatus.inProgress => 'Em andamento',
  InteractionStatus.completed => 'Concluído',
  InteractionStatus.notCompleted => 'Não realizado',
  InteractionStatus.cancelled => 'Cancelado',
};

String _orderStatusLabel(String status) => switch (status) {
  'DRAFT' => 'Rascunho',
  'PENDING' => 'Pendente',
  'APPROVED' => 'Aprovado',
  'INVOICED' => 'Faturado',
  'REJECTED' => 'Rejeitado',
  'NO_BILLING' => 'Sem faturamento',
  _ => status,
};

String _dateLabel(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
String _timeLabel(DateTime date) =>
    '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';

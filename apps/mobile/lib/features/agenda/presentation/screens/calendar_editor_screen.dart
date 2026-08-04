import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/calendar_facility_field.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/recurrence_fields.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CalendarEditorScreen extends ConsumerStatefulWidget {
  const CalendarEditorScreen({super.key, required this.target});

  final CalendarEditorTarget target;

  @override
  ConsumerState<CalendarEditorScreen> createState() =>
      _CalendarEditorScreenState();
}

class _CalendarEditorScreenState extends ConsumerState<CalendarEditorScreen> {
  late final TextEditingController _titleController;
  bool _showValidation = false;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(calendarEditorProvider(widget.target)).draft;
    _titleController = TextEditingController(text: draft.title);
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(calendarEditorProvider(widget.target));
    final notifier = ref.read(calendarEditorProvider(widget.target).notifier);
    final errors = _showValidation
        ? notifier.validationErrors
        : const <String, String>{};
    final draft = state.draft;

    return PopScope(
      canPop: state.isSaved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmDiscard();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(_screenTitle(widget.target.mode)),
          leading: IconButton(
            tooltip: 'Voltar',
            onPressed: _attemptBack,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          actions: [
            if (widget.target.mode != CalendarEditorMode.create)
              IconButton(
                tooltip: _cancelTooltip(widget.target.mode),
                onPressed: state.isSubmitting ? null : _cancel,
                icon: const Icon(Icons.delete_outline_rounded),
              ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _Section(
                            title: 'Compromisso',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (widget.target.mode !=
                                    CalendarEditorMode.occurrence)
                                  SegmentedButton<CalendarEventKind>(
                                    segments: const [
                                      ButtonSegment(
                                        value: CalendarEventKind.interaction,
                                        icon: Icon(Icons.handshake_outlined),
                                        label: Text('Interação'),
                                      ),
                                      ButtonSegment(
                                        value: CalendarEventKind.personalBlock,
                                        icon: Icon(Icons.block_rounded),
                                        label: Text('Bloqueio pessoal'),
                                      ),
                                    ],
                                    selected: {draft.kind},
                                    onSelectionChanged: (selected) =>
                                        notifier.setKind(selected.single),
                                  ),
                                const SizedBox(height: 16),
                                TextField(
                                  key: const Key('calendar-title'),
                                  controller: _titleController,
                                  textCapitalization:
                                      TextCapitalization.sentences,
                                  decoration: InputDecoration(
                                    labelText: 'Título',
                                    hintText:
                                        draft.kind ==
                                            CalendarEventKind.interaction
                                        ? 'Ex.: Interação de acompanhamento'
                                        : 'Ex.: Horário pessoal',
                                    errorText: errors['title'],
                                  ),
                                  onChanged: notifier.setTitle,
                                ),
                                if (draft.kind ==
                                    CalendarEventKind.interaction) ...[
                                  const SizedBox(height: 16),
                                  CalendarFacilityField(
                                    selected: draft.facilityId == null
                                        ? null
                                        : CalendarIdentity(
                                            id: draft.facilityId!,
                                            name:
                                                draft.facilityName ??
                                                'Clínica selecionada',
                                          ),
                                    errorText: errors['facilityId'],
                                    onChanged: notifier.setFacility,
                                  ),
                                  const SizedBox(height: 16),
                                  DropdownButtonFormField<CalendarModality>(
                                    initialValue: draft.modality,
                                    decoration: const InputDecoration(
                                      labelText: 'Modalidade',
                                    ),
                                    items: const [
                                      DropdownMenuItem(
                                        value: CalendarModality.inPerson,
                                        child: Text('Presencial'),
                                      ),
                                      DropdownMenuItem(
                                        value: CalendarModality.remote,
                                        child: Text('Remoto'),
                                      ),
                                    ],
                                    onChanged: (value) {
                                      if (value != null) {
                                        notifier.setModality(value);
                                      }
                                    },
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          _Section(
                            title: 'Data e horário',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    final compact = constraints.maxWidth < 480;
                                    final dateButton = OutlinedButton.icon(
                                      key: const Key('calendar-date'),
                                      icon: const Icon(Icons.event_rounded),
                                      label: Text(_formatDate(draft.startsAt)),
                                      onPressed: () =>
                                          _pickDate(draft.startsAt, notifier),
                                    );
                                    final timeButton = OutlinedButton.icon(
                                      key: const Key('calendar-time'),
                                      icon: const Icon(Icons.schedule_rounded),
                                      label: Text(_formatTime(draft.startsAt)),
                                      onPressed: () =>
                                          _pickTime(draft.startsAt, notifier),
                                    );
                                    if (compact) {
                                      return Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          dateButton,
                                          const SizedBox(height: 10),
                                          timeButton,
                                        ],
                                      );
                                    }
                                    return Row(
                                      children: [
                                        Expanded(child: dateButton),
                                        const SizedBox(width: 12),
                                        Expanded(child: timeButton),
                                      ],
                                    );
                                  },
                                ),
                                const SizedBox(height: 16),
                                DropdownButtonFormField<int>(
                                  key: const Key('calendar-duration'),
                                  initialValue:
                                      _durationOptions.contains(
                                        draft.durationMinutes,
                                      )
                                      ? draft.durationMinutes
                                      : null,
                                  decoration: InputDecoration(
                                    labelText: 'Duração',
                                    errorText: errors['durationMinutes'],
                                  ),
                                  hint: Text(
                                    '${draft.durationMinutes} minutos',
                                  ),
                                  items: _durationOptions
                                      .map(
                                        (minutes) => DropdownMenuItem(
                                          value: minutes,
                                          child: Text('$minutes minutos'),
                                        ),
                                      )
                                      .toList(growable: false),
                                  onChanged: (value) {
                                    if (value != null) {
                                      notifier.setDurationMinutes(value);
                                    }
                                  },
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  'Fuso horário: ${draft.timeZone}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.gray600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (widget.target.mode !=
                              CalendarEditorMode.occurrence) ...[
                            const SizedBox(height: 16),
                            _Section(
                              title: 'Repetição',
                              child: RecurrenceFields(
                                draft: draft,
                                onRecurrenceChanged: notifier.setRecurrence,
                                onEndChanged: notifier.setRecurrenceEnd,
                                onUntilChanged: notifier.setRecurrenceUntil,
                                onCountChanged: notifier.setRecurrenceCount,
                              ),
                            ),
                          ],
                          if (state.errorMessage != null) ...[
                            const SizedBox(height: 16),
                            Semantics(
                              liveRegion: true,
                              child: Container(
                                key: const Key('calendar-editor-error'),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.red50,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      state.errorMessage!,
                                      style: const TextStyle(
                                        color: AppColors.redDark,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (state.canRetry) ...[
                                      const SizedBox(height: 8),
                                      TextButton(
                                        onPressed: state.isSubmitting
                                            ? null
                                            : () async {
                                                if (await notifier.retry() &&
                                                    mounted) {
                                                  _finish();
                                                }
                                              },
                                        child: const Text('Tentar novamente'),
                                      ),
                                    ] else if (widget.target.mode !=
                                        CalendarEditorMode.create) ...[
                                      const SizedBox(height: 8),
                                      TextButton(
                                        onPressed: () {
                                          ref.invalidate(
                                            calendarRepositoryProvider,
                                          );
                                          Navigator.of(context).pop();
                                        },
                                        child: const Text('Recarregar agenda'),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              DecoratedBox(
                decoration: const BoxDecoration(
                  color: AppColors.cardBg,
                  border: Border(top: BorderSide(color: AppColors.gray200)),
                ),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    12,
                    16,
                    12 + MediaQuery.paddingOf(context).bottom,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: state.isSubmitting ? null : _submit,
                          icon: state.isSubmitting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.check_rounded),
                          label: Text(
                            state.isSubmitting
                                ? 'Salvando…'
                                : widget.target.mode ==
                                      CalendarEditorMode.create
                                ? 'Salvar compromisso'
                                : 'Salvar alterações',
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final notifier = ref.read(calendarEditorProvider(widget.target).notifier);
    setState(() => _showValidation = true);
    if (await notifier.submit() && mounted) _finish();
  }

  void _finish() {
    ref.invalidate(calendarRepositoryProvider);
    Navigator.of(context).pop(true);
  }

  Future<void> _pickDate(
    DateTime current,
    CalendarEditorNotifier notifier,
  ) async {
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      helpText: 'Data do compromisso',
      cancelText: 'Cancelar',
      confirmText: 'Selecionar',
    );
    if (date != null) {
      notifier.setStartsAt(
        DateTime(date.year, date.month, date.day, current.hour, current.minute),
      );
    }
  }

  Future<void> _pickTime(
    DateTime current,
    CalendarEditorNotifier notifier,
  ) async {
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
      helpText: 'Horário do compromisso',
      cancelText: 'Cancelar',
      confirmText: 'Selecionar',
    );
    if (time != null) {
      notifier.setStartsAt(
        DateTime(
          current.year,
          current.month,
          current.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  Future<void> _cancel() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          widget.target.mode == CalendarEditorMode.occurrence
              ? 'Cancelar esta ocorrência?'
              : 'Cancelar esta série?',
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Motivo do cancelamento',
            hintText: 'Informe por que o compromisso será cancelado',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Voltar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Cancelar compromisso'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty || !mounted) return;
    final notifier = ref.read(calendarEditorProvider(widget.target).notifier);
    if (await notifier.cancel(reason) && mounted) _finish();
  }

  void _attemptBack() {
    final state = ref.read(calendarEditorProvider(widget.target));
    if (state.isSaved) {
      Navigator.of(context).pop();
    } else {
      _confirmDiscard();
    }
  }

  Future<void> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Descartar rascunho?'),
        content: const Text('As informações preenchidas serão perdidas.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Continuar editando'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) Navigator.of(context).pop();
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.cardBg,
      border: Border.all(color: AppColors.gray200),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
            color: AppColors.gray900,
          ),
        ),
        const SizedBox(height: 14),
        child,
      ],
    ),
  );
}

const _durationOptions = [30, 60, 90, 120, 150, 180, 240];

String _screenTitle(CalendarEditorMode mode) => switch (mode) {
  CalendarEditorMode.create => 'Novo compromisso',
  CalendarEditorMode.series => 'Editar toda a série',
  CalendarEditorMode.occurrence => 'Editar ocorrência',
};

String _cancelTooltip(CalendarEditorMode mode) => switch (mode) {
  CalendarEditorMode.create => 'Cancelar compromisso',
  CalendarEditorMode.series => 'Cancelar toda a série',
  CalendarEditorMode.occurrence => 'Cancelar esta ocorrência',
};

String _formatDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/'
    '${value.month.toString().padLeft(2, '0')}/'
    '${value.year}';

String _formatTime(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:'
    '${value.minute.toString().padLeft(2, '0')}';

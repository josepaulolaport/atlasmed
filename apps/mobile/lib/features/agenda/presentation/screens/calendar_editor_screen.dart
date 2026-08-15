import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_form_styles.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/calendar_facility_selector.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_schedule_picker.dart';
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

  /// The error sits at the bottom of a scrolling form, so a failed save looked
  /// like nothing had happened at all until you scrolled down to find it.
  final _errorKey = GlobalKey();

  void _revealError() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final context = _errorKey.currentContext;
      if (context == null) return;
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        alignment: 0.2,
      );
    });
  }

  /// Editing an existing appointment never re-asks for the clinic — the series
  /// owns it — so only a new one takes its behaviour from the entry point.
  CalendarFacilityChoice get _facilityChoice =>
      widget.target.mode == CalendarEditorMode.create
      ? (widget.target.prefill?.facilityChoice ??
            CalendarFacilityChoice.anyClinic)
      : CalendarFacilityChoice.anyClinic;

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
                            icon: Icons.handshake_outlined,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (widget.target.mode !=
                                    CalendarEditorMode.occurrence) ...[
                                  _KindToggle(
                                    value: draft.kind,
                                    onChanged: notifier.setKind,
                                  ),
                                  const SizedBox(height: 18),
                                ],
                                TextField(
                                  key: const Key('calendar-title'),
                                  controller: _titleController,
                                  textCapitalization:
                                      TextCapitalization.sentences,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.gray900,
                                  ),
                                  decoration: appFieldDecoration(
                                    label: 'Título',
                                    hint:
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
                                  CalendarFacilitySelector(
                                    choice: _facilityChoice,
                                    personId: widget.target.prefill?.personId,
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
                                    decoration: appFieldDecoration(
                                      label: 'Modalidade',
                                    ),
                                    borderRadius: BorderRadius.circular(12),
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
                            icon: Icons.schedule_rounded,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: _PickerTile(
                                        fieldKey: const Key('calendar-date'),
                                        icon: Icons.event_rounded,
                                        label: 'Data',
                                        value: _formatDate(draft.startsAt),
                                        onTap: () =>
                                            _pickDate(draft.startsAt, notifier),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: _PickerTile(
                                        fieldKey: const Key('calendar-time'),
                                        icon: Icons.access_time_rounded,
                                        label: 'Início',
                                        value: _formatTime(draft.startsAt),
                                        onTap: () =>
                                            _pickTime(draft.startsAt, notifier),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                // The day's own agenda, so the time is chosen
                                // against what is already booked instead of
                                // discovering the clash on save.
                                DaySchedulePicker(
                                  day: draft.startsAt,
                                  durationMinutes: draft.durationMinutes,
                                  selectedStartsAt: draft.startsAt,
                                  excludeOccurrenceId:
                                      widget.target.occurrence?.occurrenceId,
                                  onPick: (slot) => notifier.setStartsAt(slot),
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
                                  decoration: appFieldDecoration(
                                    label: 'Duração',
                                    errorText: errors['durationMinutes'],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
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
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.public_rounded,
                                      size: 13,
                                      color: AppColors.gray400,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        'Fuso horário: ${draft.timeZone}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.gray500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (widget.target.mode !=
                              CalendarEditorMode.occurrence) ...[
                            const SizedBox(height: 16),
                            _Section(
                              title: 'Repetição',
                              icon: Icons.event_repeat_rounded,
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
                                key: _errorKey,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.red50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColors.red100),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      key: const Key('calendar-editor-error'),
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Icon(
                                          Icons.error_outline_rounded,
                                          size: 18,
                                          color: AppColors.redDark,
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            state.errorMessage!,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              height: 1.35,
                                              color: AppColors.redDark,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ],
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
                        height: 52,
                        child: FilledButton.icon(
                          onPressed: state.isSubmitting ? null : _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.navyBright,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: AppColors.gray300,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          icon: state.isSubmitting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.check_rounded, size: 20),
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
    if (await notifier.submit() && mounted) {
      _finish();
      return;
    }
    // Failed. The reason is rendered at the foot of the form, so bring it into
    // view instead of leaving the screen looking inert.
    if (mounted) _revealError();
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

/// The house card: white, hairline border, soft shadow, an icon chip beside the
/// title — the same shell the clinic and doctor sections use.
class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    required this.icon,
  });

  final String title;
  final Widget child;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
    decoration: BoxDecoration(
      color: AppColors.cardBg,
      border: Border.all(color: AppColors.surfaceSecondary),
      borderRadius: BorderRadius.circular(16),
      boxShadow: [
        BoxShadow(
          color: AppColors.gray900.withValues(alpha: 0.03),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.blue50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 15, color: AppColors.navyBright),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                  letterSpacing: -0.1,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        child,
      ],
    ),
  );
}

/// Date and start time, as tappable tiles rather than outlined buttons that
/// read as secondary actions when they are in fact the two main fields.
class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.fieldKey,
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final Key fieldKey;
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surfaceTertiary,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      key: fieldKey,
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppColors.navyBright),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray500,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Interação vs bloqueio pessoal. `SegmentedButton` wrapped its labels onto two
/// lines at phone width and drew Material's own mauve selection; this says the
/// same thing in the app's own blue and fits.
class _KindToggle extends StatelessWidget {
  const _KindToggle({required this.value, required this.onChanged});

  final CalendarEventKind value;
  final ValueChanged<CalendarEventKind> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.surfaceSecondary),
    ),
    child: Row(
      children: [
        _KindOption(
          icon: Icons.handshake_outlined,
          label: 'Interação',
          selected: value == CalendarEventKind.interaction,
          onTap: () => onChanged(CalendarEventKind.interaction),
        ),
        const SizedBox(width: 4),
        _KindOption(
          icon: Icons.block_rounded,
          label: 'Bloqueio pessoal',
          selected: value == CalendarEventKind.personalBlock,
          onTap: () => onChanged(CalendarEventKind.personalBlock),
        ),
      ],
    ),
  );
}

class _KindOption extends StatelessWidget {
  const _KindOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.navyBright : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(9),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 15,
                  color: selected ? Colors.white : AppColors.gray500,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: selected ? Colors.white : AppColors.gray700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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

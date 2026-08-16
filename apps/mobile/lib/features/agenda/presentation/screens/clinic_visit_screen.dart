import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_schedule_picker.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_form_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Scheduling a visit to one clinic.
///
/// The general calendar editor can do this, and used to: "Visita" opened it
/// with the clinic pre-filled. But that screen exists to create *any* calendar
/// entry, so it opens by asking which kind — interação or bloqueio pessoal —
/// and then offers a clinic picker. Both questions are already answered before
/// this screen opens: it is a visit, and it is to this clinic. Leaving them on
/// screen asks the rep to re-state what they just said by tapping "Visita" on a
/// clinic, and gives them a way to get it wrong.
///
/// So the same controller, the same validation and the same submit — a
/// different form over them. What is left is genuinely open: when, how long,
/// and whether it repeats.
class ClinicVisitScreen extends ConsumerStatefulWidget {
  const ClinicVisitScreen({
    super.key,
    required this.facilityId,
    required this.facilityName,
  });

  final int facilityId;
  final String facilityName;

  @override
  ConsumerState<ClinicVisitScreen> createState() => _ClinicVisitScreenState();
}

class _ClinicVisitScreenState extends ConsumerState<ClinicVisitScreen> {
  static const _durations = [15, 30, 45, 60, 90, 120];

  late final CalendarEditorTarget _target;
  late final TextEditingController _notes;
  bool _showValidation = false;

  @override
  void initState() {
    super.initState();
    _target = CalendarEditorTarget.creating(
      prefill: CalendarEditorPrefill(
        facilityId: widget.facilityId,
        facilityName: widget.facilityName,
        // Fixed, not offered: this screen only makes visits.
        kind: CalendarEventKind.interaction,
        title: 'Visita · ${widget.facilityName}',
        facilityChoice: CalendarFacilityChoice.anyClinic,
      ),
    );
    _notes = TextEditingController(
      text: ref.read(calendarEditorProvider(_target)).draft.title,
    );
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(calendarEditorProvider(_target));
    final notifier = ref.read(calendarEditorProvider(_target).notifier);
    final draft = state.draft;
    final errors = _showValidation
        ? notifier.validationErrors
        : const <String, String>{};

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          'Agendar visita',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                // The clinic as a fact, not a field. It is why this screen is
                // open; a picker here could only be used to make it wrong.
                _ClinicHeader(name: widget.facilityName),
                const SizedBox(height: 18),
                const _Label('Quando'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _PickerTile(
                        fieldKey: const Key('visit-date'),
                        icon: Icons.event_rounded,
                        label: 'Data',
                        value: _formatDate(draft.startsAt),
                        onTap: () => _pickDate(draft.startsAt, notifier),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PickerTile(
                        fieldKey: const Key('visit-time'),
                        icon: Icons.access_time_rounded,
                        label: 'Início',
                        value: _formatTime(draft.startsAt),
                        onTap: () => _pickTime(draft.startsAt, notifier),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // The day's own agenda, so the time is chosen against what is
                // already booked rather than discovering the clash on save.
                DaySchedulePicker(
                  day: draft.startsAt,
                  durationMinutes: draft.durationMinutes,
                  selectedStartsAt: draft.startsAt,
                  onPick: notifier.setStartsAt,
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  key: const Key('visit-duration'),
                  initialValue: _durations.contains(draft.durationMinutes)
                      ? draft.durationMinutes
                      : null,
                  decoration: appFieldDecoration(
                    label: 'Duração',
                    errorText: errors['durationMinutes'],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  hint: Text('${draft.durationMinutes} minutos'),
                  items: _durations
                      .map(
                        (minutes) => DropdownMenuItem(
                          value: minutes,
                          child: Text('$minutes minutos'),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) {
                    if (value != null) notifier.setDurationMinutes(value);
                  },
                ),
                const SizedBox(height: 16),
                _ModalityToggle(
                  value: draft.modality,
                  onChanged: notifier.setModality,
                ),
                const SizedBox(height: 22),
                const _Label('Assunto'),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('visit-title'),
                  controller: _notes,
                  textCapitalization: TextCapitalization.sentences,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                  decoration: appFieldDecoration(
                    label: 'Título',
                    hint: 'Ex.: Visita de acompanhamento',
                    errorText: errors['title'],
                  ),
                  onChanged: notifier.setTitle,
                ),
                const SizedBox(height: 6),
                Text(
                  'Já preenchido com o nome da clínica. Troque se a visita '
                  'tiver um motivo específico.',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.gray500,
                    height: 1.35,
                  ),
                ),
                if (state.errorMessage != null) ...[
                  const SizedBox(height: 18),
                  _ErrorBox(
                    message: state.errorMessage!,
                    onRetry: state.canRetry && !state.isSubmitting
                        ? () async {
                            if (await notifier.retry() && mounted) _finish();
                          }
                        : null,
                  ),
                ],
              ],
            ),
          ),
          _SubmitBar(submitting: state.isSubmitting, onSubmit: _submit),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    final notifier = ref.read(calendarEditorProvider(_target).notifier);
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
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      helpText: 'Data da visita',
    );
    if (picked == null) return;
    notifier.setStartsAt(
      DateTime(
        picked.year,
        picked.month,
        picked.day,
        current.hour,
        current.minute,
      ),
    );
  }

  Future<void> _pickTime(
    DateTime current,
    CalendarEditorNotifier notifier,
  ) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
      helpText: 'Início da visita',
    );
    if (picked == null) return;
    notifier.setStartsAt(
      DateTime(
        current.year,
        current.month,
        current.day,
        picked.hour,
        picked.minute,
      ),
    );
  }

  String _formatDate(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/'
      '${value.month.toString().padLeft(2, '0')}/${value.year}';

  String _formatTime(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:'
      '${value.minute.toString().padLeft(2, '0')}';
}

class _ClinicHeader extends StatelessWidget {
  const _ClinicHeader({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.blue100, AppColors.blueLight],
              ),
            ),
            child: const Icon(
              Icons.local_hospital_rounded,
              size: 21,
              color: AppColors.navyBright,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'VISITA A',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppColors.gray400,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Presencial or remoto — two options, so two buttons rather than a dropdown
/// that has to be opened to find out what it holds.
class _ModalityToggle extends StatelessWidget {
  const _ModalityToggle({required this.value, required this.onChanged});

  final CalendarModality value;
  final ValueChanged<CalendarModality> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ModalityOption(
            key: const Key('visit-modality-in-person'),
            icon: Icons.directions_walk_rounded,
            label: 'Presencial',
            selected: value == CalendarModality.inPerson,
            onTap: () => onChanged(CalendarModality.inPerson),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ModalityOption(
            key: const Key('visit-modality-remote'),
            icon: Icons.videocam_outlined,
            label: 'Remoto',
            selected: value == CalendarModality.remote,
            onTap: () => onChanged(CalendarModality.remote),
          ),
        ),
      ],
    );
  }
}

class _ModalityOption extends StatelessWidget {
  const _ModalityOption({
    super.key,
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
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? AppColors.navyBright.withValues(alpha: 0.08)
          : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.navyBright : AppColors.gray200,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 17,
                color: selected ? AppColors.navyDeep : AppColors.gray500,
              ),
              const SizedBox(width: 8),
              // Flexible, or "Presencial" beside its icon overruns the half
              // width these two share on a narrow phone.
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: selected ? AppColors.navyDeep : AppColors.gray700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        key: fieldKey,
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.gray200),
          ),
          child: Row(
            children: [
              Icon(icon, size: 17, color: AppColors.navyBright),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray500,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
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
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w700,
      color: AppColors.gray700,
      letterSpacing: 0.2,
    ),
  );
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('visit-error'),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 18,
                color: AppColors.redDark,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
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
          if (onRetry != null) ...[
            const SizedBox(height: 6),
            TextButton(
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({required this.submitting, required this.onSubmit});

  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton.icon(
            key: const Key('visit-submit'),
            onPressed: submitting ? null : onSubmit,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.navyBright,
              foregroundColor: Colors.white,
              disabledBackgroundColor: AppColors.gray300,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            icon: submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_rounded, size: 19),
            label: Text(
              submitting ? 'Agendando…' : 'Agendar visita',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_form_styles.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/wheel_picker_sheet.dart';
import 'package:flutter/material.dart';

class RecurrenceFields extends StatelessWidget {
  const RecurrenceFields({
    super.key,
    required this.draft,
    required this.onRecurrenceChanged,
    required this.onEndChanged,
    required this.onUntilChanged,
    required this.onCountChanged,
  });

  final CalendarEditorDraft draft;
  final ValueChanged<CalendarRecurrence> onRecurrenceChanged;
  final ValueChanged<CalendarRecurrenceEnd> onEndChanged;
  final ValueChanged<DateTime> onUntilChanged;
  final ValueChanged<int?> onCountChanged;

  @override
  Widget build(BuildContext context) {
    final recurring = draft.recurrence != CalendarRecurrence.none;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // A sheet rather than Material's own menu: the form is rounded and
        // navy everywhere else, and the dropdown drew grey square corners
        // anchored to the field.
        _RecurrenceTile(
          value: draft.recurrence,
          onTap: () async {
            final picked = await showOptionSheet<CalendarRecurrence>(
              context,
              title: 'Repetição',
              selected: draft.recurrence,
              options: [
                for (final value in CalendarRecurrence.values)
                  (
                    value: value,
                    label: recurrenceLabel(value),
                    icon: value == CalendarRecurrence.none
                        ? Icons.block_outlined
                        : Icons.repeat_rounded,
                  ),
              ],
            );
            if (picked != null) onRecurrenceChanged(picked);
          },
        ),
        if (recurring) ...[
          const SizedBox(height: 16),
          Text(
            'Término da repetição',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 8),
          SegmentedButton<CalendarRecurrenceEnd>(
            segments: const [
              ButtonSegment(
                value: CalendarRecurrenceEnd.none,
                label: Text('Sem término'),
              ),
              ButtonSegment(
                value: CalendarRecurrenceEnd.date,
                label: Text('Data'),
              ),
              ButtonSegment(
                value: CalendarRecurrenceEnd.count,
                label: Text('Quantidade'),
              ),
            ],
            selected: {draft.recurrenceEnd},
            onSelectionChanged: (selected) => onEndChanged(selected.single),
          ),
          const SizedBox(height: 12),
          if (draft.recurrenceEnd == CalendarRecurrenceEnd.date)
            OutlinedButton.icon(
              key: const Key('calendar-recurrence-until'),
              icon: const Icon(Icons.event_rounded),
              label: Text(
                draft.recurrenceUntil == null
                    ? 'Escolher data final'
                    : _formatDate(draft.recurrenceUntil!),
              ),
              onPressed: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: draft.recurrenceUntil ?? draft.startsAt,
                  firstDate: draft.startsAt,
                  lastDate: DateTime(draft.startsAt.year + 10),
                  helpText: 'Data final da repetição',
                  cancelText: 'Cancelar',
                  confirmText: 'Selecionar',
                );
                if (date != null) onUntilChanged(date);
              },
            ),
          if (draft.recurrenceEnd == CalendarRecurrenceEnd.count)
            TextFormField(
              key: const Key('calendar-recurrence-count'),
              initialValue: draft.recurrenceCount?.toString(),
              keyboardType: TextInputType.number,
              decoration: appFieldDecoration(
                label: 'Número de ocorrências',
                hint: 'Ex.: 6',
              ),
              onChanged: (value) => onCountChanged(int.tryParse(value)),
            ),
          if (draft.recurrence == CalendarRecurrence.monthly ||
              draft.recurrence == CalendarRecurrence.yearly) ...[
            const SizedBox(height: 10),
            const Text(
              'Se o dia não existir em um mês ou ano futuro, a ocorrência será ajustada para o último dia válido.',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.gray600,
                height: 1.35,
              ),
            ),
          ],
        ],
      ],
    );
  }
}

/// Shared with the day grid's quick sheet, which asks the same question in a
/// smaller space — two places offering "Semanalmente" and "Semanal" would read
/// as two different settings.
String recurrenceLabel(CalendarRecurrence value) => switch (value) {
  CalendarRecurrence.none => 'Não repetir',
  CalendarRecurrence.daily => 'Diariamente',
  CalendarRecurrence.weekly => 'Semanalmente',
  CalendarRecurrence.monthly => 'Mensal',
  CalendarRecurrence.yearly => 'Anual',
};

String _formatDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/'
    '${value.month.toString().padLeft(2, '0')}/'
    '${value.year}';

/// Matches `_PickerTile` in the editor — same height, same chrome, so the
/// recurrence row does not look like a different app from the date beside it.
class _RecurrenceTile extends StatelessWidget {
  const _RecurrenceTile({required this.value, required this.onTap});

  final CalendarRecurrence value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surfaceTertiary,
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      key: const Key('calendar-recurrence'),
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
            const Icon(
              Icons.repeat_rounded,
              size: 18,
              color: AppColors.navyBright,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Repetição',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray500,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    recurrenceLabel(value),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.expand_more_rounded,
              size: 18,
              color: AppColors.gray400,
            ),
          ],
        ),
      ),
    ),
  );
}

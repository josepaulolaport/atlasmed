import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
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
        DropdownButtonFormField<CalendarRecurrence>(
          key: const Key('calendar-recurrence'),
          initialValue: draft.recurrence,
          decoration: const InputDecoration(labelText: 'Repetição'),
          items: CalendarRecurrence.values
              .map(
                (value) => DropdownMenuItem(
                  value: value,
                  child: Text(_recurrenceLabel(value)),
                ),
              )
              .toList(growable: false),
          onChanged: (value) {
            if (value != null) onRecurrenceChanged(value);
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
              decoration: const InputDecoration(
                labelText: 'Número de ocorrências',
                hintText: 'Ex.: 6',
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

String _recurrenceLabel(CalendarRecurrence value) => switch (value) {
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

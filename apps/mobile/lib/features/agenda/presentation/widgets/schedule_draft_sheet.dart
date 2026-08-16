import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/clinic_picker_sheet.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

const _weekdayNames = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
];
const _monthNames = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

String _dayLabel(DateTime day) =>
    '${_weekdayNames[day.weekday - 1]}, ${day.day} ${_monthNames[day.month - 1]}';

/// What the rep is about to put in the slot they drew.
class ScheduleDraftValue {
  const ScheduleDraftValue({
    required this.kind,
    required this.title,
    required this.facility,
  });

  final CalendarEventKind kind;
  final String title;
  final CalendarIdentity? facility;
}

/// The bar under a block the rep is drawing on the day grid.
///
/// Deliberately the *small* half of the job. Most appointments need a name, a
/// time and a clinic, and two of those are already on screen — asking for
/// modality, recurrence and duration before the rep has decided the thing is
/// happening is what makes scheduling feel like paperwork. Everything else goes
/// through **Mais opções**, which opens the full editor on this same block
/// rather than starting over.
///
/// The kind chips are not decoration: an interaction requires a clinic and a
/// personal block must not have one, so this is the question that decides
/// whether the rest of the sheet applies at all.
class ScheduleDraftSheet extends StatefulWidget {
  const ScheduleDraftSheet({
    super.key,
    required this.day,
    required this.draft,
    required this.clashes,
    required this.onCancel,
    required this.onSave,
    required this.onMoreOptions,
    this.saving = false,
    this.errorText,
  });

  final DateTime day;
  final DayGridDraft draft;

  /// What this block runs into. Shown, not blocked: only the rep knows whether
  /// two things at once is a mistake or the plan, and the API is the one that
  /// gets to refuse.
  final List<CalendarOccurrence> clashes;

  final VoidCallback onCancel;
  final ValueChanged<ScheduleDraftValue> onSave;
  final ValueChanged<ScheduleDraftValue> onMoreOptions;
  final bool saving;
  final String? errorText;

  @override
  State<ScheduleDraftSheet> createState() => _ScheduleDraftSheetState();
}

class _ScheduleDraftSheetState extends State<ScheduleDraftSheet> {
  final _title = TextEditingController();
  CalendarEventKind _kind = CalendarEventKind.interaction;
  CalendarIdentity? _facility;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  ScheduleDraftValue get _value => ScheduleDraftValue(
    kind: _kind,
    title: _title.text.trim(),
    facility: _kind == CalendarEventKind.interaction ? _facility : null,
  );

  bool get _canSave =>
      _title.text.trim().isNotEmpty &&
      (_kind == CalendarEventKind.personalBlock || _facility != null);

  @override
  Widget build(BuildContext context) {
    final range =
        '${formatSlot(widget.draft.startMinutes)}–${formatSlot(widget.draft.endMinutes)}';

    return Material(
      color: AppColors.cardBg,
      elevation: 12,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 8,
            // Rides above the keyboard: the title field is focused on open, and
            // a sheet the keyboard covers is a sheet nobody fills in.
            bottom: 12 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    IconButton(
                      tooltip: 'Descartar',
                      onPressed: widget.saving ? null : widget.onCancel,
                      icon: const Icon(Icons.close, size: 20),
                    ),
                    const Spacer(),
                    FilledButton(
                      onPressed: widget.saving || !_canSave
                          ? null
                          : () => widget.onSave(_value),
                      child: widget.saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Salvar'),
                    ),
                  ],
                ),
                Row(
                  children: [
                    _KindChip(
                      label: 'Visita',
                      selected: _kind == CalendarEventKind.interaction,
                      onTap: () =>
                          setState(() => _kind = CalendarEventKind.interaction),
                    ),
                    const SizedBox(width: 8),
                    _KindChip(
                      label: 'Bloqueio pessoal',
                      selected: _kind == CalendarEventKind.personalBlock,
                      onTap: () => setState(
                        () => _kind = CalendarEventKind.personalBlock,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _title,
                  autofocus: true,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'Adicionar título',
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(
                      Icons.schedule,
                      size: 15,
                      color: AppColors.gray500,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${_dayLabel(widget.day)} · $range',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.gray600,
                      ),
                    ),
                  ],
                ),
                // A visit is an interaction and an interaction has a clinic;
                // a personal block is the rep's own time and must not carry
                // one, so the field is absent rather than merely optional.
                if (_kind == CalendarEventKind.interaction) ...[
                  const SizedBox(height: 8),
                  _ClinicRow(
                    selected: _facility,
                    onPick: () async {
                      final picked = await showClinicPicker(context);
                      if (picked != null) setState(() => _facility = picked);
                    },
                    onClear: () => setState(() => _facility = null),
                  ),
                ],
                if (widget.clashes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _Note(
                    icon: Icons.warning_amber_rounded,
                    colour: AppColors.amber,
                    text:
                        'Conflita com ${widget.clashes.first.title}'
                        '${widget.clashes.length > 1 ? ' e mais ${widget.clashes.length - 1}' : ''}.',
                  ),
                ],
                if (widget.errorText != null) ...[
                  const SizedBox(height: 8),
                  _Note(
                    icon: Icons.error_outline,
                    colour: AppColors.red,
                    text: widget.errorText!,
                  ),
                ],
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: widget.saving
                        ? null
                        : () => widget.onMoreOptions(_value),
                    icon: const Icon(Icons.tune, size: 16),
                    label: const Text('Mais opções'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The clinic, as a row that opens a picker rather than a search box.
///
/// A search field here would put its results below the bottom of the screen —
/// the sheet is already pinned there — so the rep would type and watch nothing
/// happen. The picker gets its own sheet, with room for the list.
class _ClinicRow extends StatelessWidget {
  const _ClinicRow({
    required this.selected,
    required this.onPick,
    required this.onClear,
  });

  final CalendarIdentity? selected;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final chosen = selected;
    return InkWell(
      onTap: onPick,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.gray300),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.local_hospital_outlined,
              size: 17,
              color: AppColors.gray500,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                chosen?.name ?? 'Selecionar clínica',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: chosen == null
                      ? FontWeight.w400
                      : FontWeight.w600,
                  color: chosen == null ? AppColors.gray500 : AppColors.gray900,
                ),
              ),
            ),
            if (chosen != null)
              IconButton(
                tooltip: 'Limpar clínica',
                visualDensity: VisualDensity.compact,
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded, size: 17),
              )
            else
              const Icon(
                Icons.chevron_right,
                size: 18,
                color: AppColors.gray400,
              ),
          ],
        ),
      ),
    );
  }
}

class _KindChip extends StatelessWidget {
  const _KindChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(20),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: selected ? AppColors.navyBright : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: selected ? AppColors.navyBright : AppColors.gray300,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : AppColors.gray700,
        ),
      ),
    ),
  );
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.colour, required this.text});

  final IconData icon;
  final Color colour;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 15, color: colour),
      const SizedBox(width: 8),
      Expanded(
        child: Text(text, style: TextStyle(fontSize: 12, color: colour)),
      ),
    ],
  );
}

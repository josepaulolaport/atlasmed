import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/wheel_picker_sheet.dart';
import 'package:flutter/material.dart';

/// Where a rep says when they actually work — spec 0016 §15.5.5.
///
/// Until this existed, `roteiro_params` held one set of hours per *linha*, so
/// every rep in a territory was planned against the same 08:00–18:00. A rep who
/// starts at 06:00 lost two hours of their day, every day; one who stops at
/// 16:00 was handed visits they were never going to make.
///
/// Leaving a field on "padrão da linha" is a real answer, not an empty one: it
/// keeps following the linha when the linha changes, which is what someone who
/// has no opinion actually wants.
class WorkingHoursSheet extends StatefulWidget {
  const WorkingHoursSheet({super.key, required this.current});

  final UserPreferences current;

  @override
  State<WorkingHoursSheet> createState() => _WorkingHoursSheetState();
}

class _WorkingHoursSheetState extends State<WorkingHoursSheet> {
  late String? _start = widget.current.workdayStart;
  late String? _end = widget.current.workdayEnd;
  late String? _lunch = widget.current.lunchStart;

  static const _linhaDefaults = (start: '08:00', end: '18:00', lunch: '12:00');

  Future<void> _pick(
    String? value,
    String fallback,
    String title,
    void Function(String) set,
  ) async {
    final parts = (value ?? fallback).split(':');
    // The house wheel, like every other time in the app. It was the Material
    // dial, which rendered in English and looked nothing like the rest.
    final chosen = await showTimeWheelPicker(
      context,
      title: title,
      initial: DateTime(
        2000,
        1,
        1,
        int.tryParse(parts.first) ?? 8,
        int.tryParse(parts.last) ?? 0,
      ),
    );
    if (chosen == null) return;
    set(
      '${chosen.hour.toString().padLeft(2, '0')}:'
      '${chosen.minute.toString().padLeft(2, '0')}',
    );
  }

  bool get _ordered {
    final start = _start ?? _linhaDefaults.start;
    final end = _end ?? _linhaDefaults.end;
    return end.compareTo(start) > 0;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Horário de trabalho',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'O roteiro do dia só sugere visitas dentro deste horário.',
              style: TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            _HourRow(
              label: 'Começo',
              value: _start,
              fallback: _linhaDefaults.start,
              onPick: () => _pick(
                _start,
                _linhaDefaults.start,
                'Começo do dia',
                (v) => setState(() => _start = v),
              ),
              onClear: _start == null
                  ? null
                  : () => setState(() => _start = null),
            ),
            _HourRow(
              label: 'Fim',
              value: _end,
              fallback: _linhaDefaults.end,
              onPick: () => _pick(
                _end,
                _linhaDefaults.end,
                'Fim do dia',
                (v) => setState(() => _end = v),
              ),
              onClear: _end == null ? null : () => setState(() => _end = null),
            ),
            _HourRow(
              label: 'Almoço',
              value: _lunch,
              fallback: _linhaDefaults.lunch,
              onPick: () => _pick(
                _lunch,
                _linhaDefaults.lunch,
                'Começo do almoço',
                (v) => setState(() => _lunch = v),
              ),
              onClear: _lunch == null
                  ? null
                  : () => setState(() => _lunch = null),
            ),
            if (!_ordered)
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(
                  'O fim precisa ser depois do começo.',
                  style: TextStyle(fontSize: 12, color: AppColors.amber),
                ),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _ordered
                  ? () => Navigator.of(context).pop(
                      UpdateUserPreferencesPayload(
                        // Nulls are meaningful here — see includeWorkingHours.
                        includeWorkingHours: true,
                        workdayStart: _start,
                        workdayEnd: _end,
                        lunchStart: _lunch,
                        lunchMinutes: widget.current.lunchMinutes,
                      ),
                    )
                  : null,
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _HourRow extends StatelessWidget {
  const _HourRow({
    required this.label,
    required this.value,
    required this.fallback,
    required this.onPick,
    required this.onClear,
  });

  final String label;
  final String? value;
  final String fallback;
  final VoidCallback onPick;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: AppColors.gray800),
            ),
          ),
          // The linha value is shown even when unset, so "padrão" is never a
          // blank the rep has to guess the meaning of.
          if (value == null)
            Text(
              'Padrão · $fallback',
              style: const TextStyle(fontSize: 13, color: AppColors.gray500),
            )
          else
            Text(
              value!,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          IconButton(
            tooltip: 'Escolher',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.edit_outlined, size: 16),
            onPressed: onPick,
          ),
          if (onClear != null)
            IconButton(
              tooltip: 'Voltar ao padrão da linha',
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.restart_alt, size: 16),
              onPressed: onClear,
            ),
        ],
      ),
    );
  }
}

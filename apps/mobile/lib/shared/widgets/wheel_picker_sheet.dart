import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/cupertino.dart' show CupertinoPicker;
import 'package:flutter/material.dart';

/// The house wheel picker, lifted from the payer-percentage sheet so a time and
/// a percentage are chosen the same way.
///
/// A wheel rather than Material's dial: every value here is one of a short,
/// ordered list, and a rep picking 14:30 on a bus should be able to nudge it
/// rather than aim at a clock face. It also keeps the sheet in the app's own
/// language — the Material pickers render in English, because the app has no
/// Material localization delegate.
class WheelPickerSheet extends StatelessWidget {
  const WheelPickerSheet({
    super.key,
    required this.title,
    required this.columns,
    required this.valueLabel,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  /// One [WheelPickerColumn] per wheel, laid out left to right.
  final List<Widget> columns;

  /// The live reading under the wheels — what pressing Confirmar will save.
  final String valueLabel;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.gray200,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            if (subtitle case final text?) ...[
              const SizedBox(height: 4),
              Text(
                text,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.gray500,
                ),
              ),
            ],
            const SizedBox(height: 8),
            SizedBox(height: 180, child: Row(children: columns)),
            const SizedBox(height: 8),
            Text(
              valueLabel,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.navyBright,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyBright,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Confirmar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One wheel. [labels] is what the rep reads; the index is what they chose.
class WheelPickerColumn extends StatelessWidget {
  const WheelPickerColumn({
    super.key,
    required this.controller,
    required this.labels,
    required this.onChanged,
    this.flex = 1,
    this.suffix,
  });

  final FixedExtentScrollController controller;
  final List<String> labels;
  final ValueChanged<int> onChanged;
  final int flex;

  /// A unit that belongs beside the wheel rather than on every row — "min",
  /// ":" between hours and minutes.
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    final wheel = Expanded(
      flex: flex,
      child: CupertinoPicker(
        scrollController: controller,
        itemExtent: 36,
        onSelectedItemChanged: onChanged,
        children: [
          for (final label in labels)
            Center(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
        ],
      ),
    );
    if (suffix == null) return wheel;
    return wheel;
  }
}

String _two(int value) => value.toString().padLeft(2, '0');

/// Picks a wall-clock time on [day]. Minutes step by five — finer than the
/// half-hour the calendar stores, coarse enough to reach in one flick.
Future<DateTime?> showTimeWheelPicker(
  BuildContext context, {
  required DateTime initial,
  String title = 'Horário',
}) async {
  const minuteStep = 5;
  var hour = initial.hour;
  var minute = (initial.minute ~/ minuteStep) * minuteStep;

  final hourController = FixedExtentScrollController(initialItem: hour);
  final minuteController = FixedExtentScrollController(
    initialItem: minute ~/ minuteStep,
  );

  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => StatefulBuilder(
      builder: (context, setState) => WheelPickerSheet(
        title: title,
        valueLabel: '${_two(hour)}:${_two(minute)}',
        columns: [
          WheelPickerColumn(
            controller: hourController,
            labels: [for (var h = 0; h < 24; h++) _two(h)],
            onChanged: (index) => setState(() => hour = index),
          ),
          const Text(
            ':',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          WheelPickerColumn(
            controller: minuteController,
            labels: [for (var m = 0; m < 60; m += minuteStep) _two(m)],
            onChanged: (index) => setState(() => minute = index * minuteStep),
          ),
        ],
      ),
    ),
  );

  hourController.dispose();
  minuteController.dispose();
  if (confirmed != true) return null;
  return DateTime(initial.year, initial.month, initial.day, hour, minute);
}

/// Picks a visit length from [options], in minutes.
Future<int?> showDurationWheelPicker(
  BuildContext context, {
  required int initial,
  required List<int> options,
  String subtitle = 'Quanto tempo a visita deve ocupar na agenda',
}) async {
  var index = options.indexOf(initial);
  if (index < 0) index = 0;

  final controller = FixedExtentScrollController(initialItem: index);

  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => StatefulBuilder(
      builder: (context, setState) => WheelPickerSheet(
        title: 'Duração',
        subtitle: subtitle,
        valueLabel: formatDurationLabel(options[index]),
        columns: [
          WheelPickerColumn(
            controller: controller,
            labels: [for (final option in options) formatDurationLabel(option)],
            onChanged: (value) => setState(() => index = value),
          ),
        ],
      ),
    ),
  );

  controller.dispose();
  return confirmed == true ? options[index] : null;
}

/// "90 minutos" reads worse than "1h30" on a wheel the rep is flicking past.
String formatDurationLabel(int minutes) {
  if (minutes < 60) return '$minutes min';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0 ? '${hours}h' : '${hours}h${_two(rest)}';
}

/// One choice from a short list, in the same sheet language as the wheels.
///
/// `DropdownButtonFormField` drew Material's own menu — grey, square-cornered,
/// anchored to the field — against a form that is rounded and navy everywhere
/// else. These are the same few options in the app's own clothes.
Future<T?> showOptionSheet<T>(
  BuildContext context, {
  required String title,
  required List<({T value, String label, IconData? icon})> options,
  required T selected,
}) {
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (sheetContext) => SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.gray200,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 10),
          // Scrollable rather than sized to its content: five recurrence
          // options overflowed a short sheet, and the list grows with the
          // vocabulary.
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              children: [
                for (final option in options)
                  ListTile(
                    leading: option.icon == null
                        ? null
                        : Icon(
                            option.icon,
                            size: 20,
                            color: option.value == selected
                                ? AppColors.navyBright
                                : AppColors.gray500,
                          ),
                    title: Text(
                      option.label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: option.value == selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: option.value == selected
                            ? AppColors.navyDeep
                            : AppColors.gray800,
                      ),
                    ),
                    trailing: option.value == selected
                        ? const Icon(
                            Icons.check_circle_rounded,
                            size: 20,
                            color: AppColors.navyBright,
                          )
                        : null,
                    onTap: () => Navigator.pop(sheetContext, option.value),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Cupertino-style scrolling date wheel in a bottom sheet.
Future<DateTime?> showDateWheelPicker(
  BuildContext context, {
  DateTime? initialDate,
  DateTime? firstDate,
  DateTime? lastDate,
}) {
  final now = DateTime.now();
  final minimum = firstDate ?? DateTime(1940);
  final maximum = lastDate ?? now;
  var selected = initialDate ?? DateTime(now.year - 30);
  if (selected.isBefore(minimum)) selected = minimum;
  if (selected.isAfter(maximum)) selected = maximum;

  return showModalBottomSheet<DateTime>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) {
      return SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
              child: Row(
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(sheetContext).pop(),
                    child: const Text(
                      'Cancelar',
                      style: TextStyle(color: AppColors.gray500),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.of(sheetContext).pop(selected),
                    child: const Text(
                      'Confirmar',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.navyDeep,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 216,
              child: CupertinoTheme(
                data: const CupertinoThemeData(
                  textTheme: CupertinoTextThemeData(
                    dateTimePickerTextStyle: TextStyle(
                      fontSize: 20,
                      color: AppColors.gray900,
                    ),
                  ),
                ),
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  dateOrder: DatePickerDateOrder.dmy,
                  initialDateTime: selected,
                  minimumDate: minimum,
                  maximumDate: maximum,
                  onDateTimeChanged: (value) => selected = value,
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}

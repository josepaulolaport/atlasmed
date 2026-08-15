import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// One field decoration for the whole agenda form, so the inputs stop each
/// looking like a different app: filled, rounded, no Material underline.
InputDecoration appFieldDecoration({
  required String label,
  String? hint,
  String? errorText,
  String? helperText,
  Widget? suffixIcon,
}) => InputDecoration(
  labelText: label,
  hintText: hint,
  errorText: errorText,
  helperText: helperText,
  suffixIcon: suffixIcon,
  filled: true,
  fillColor: AppColors.surfaceTertiary,
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
  labelStyle: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
  floatingLabelStyle: const TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.navyBright,
  ),
  hintStyle: const TextStyle(fontSize: 14, color: AppColors.gray400),
  helperStyle: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
  errorStyle: const TextStyle(fontSize: 11.5, color: AppColors.error),
  border: _outline(AppColors.surfaceSecondary),
  enabledBorder: _outline(AppColors.surfaceSecondary),
  focusedBorder: _outline(AppColors.navyBright, width: 1.5),
  errorBorder: _outline(AppColors.error),
  focusedErrorBorder: _outline(AppColors.error, width: 1.5),
);

OutlineInputBorder _outline(Color color, {double width = 1}) =>
    OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color, width: width),
    );

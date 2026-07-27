import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class AtlasButton {
  const AtlasButton._();

  static Widget outline({
    required Widget label,
    Widget? icon,
    required VoidCallback onPressed,
    double? width,
  }) {
    return SizedBox(
      width: width,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.navyBright,
          side: const BorderSide(color: AppColors.blue100),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: switch (icon) {
          null => DefaultTextStyle(
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.navyBright,
              ),
              child: label,
            ),
          _ => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                icon,
                const SizedBox(width: 8),
                DefaultTextStyle(
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.navyBright,
                  ),
                  child: label,
                ),
              ],
            ),
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class DetailQuickActions extends StatelessWidget {
  final Color themeColor;
  final List<QuickActionItem> actions;

  const DetailQuickActions({
    super.key,
    required this.themeColor,
    required this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.loose,
      children: [
        Positioned.fill(
          child: Column(
            children: [
              Expanded(child: Container(color: themeColor)),
              Expanded(child: Container(color: AppColors.surfaceTertiary)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            clipBehavior: .antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.surfaceSecondary),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: themeColor.withValues(alpha: 0.12),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: actions.map((a) => Expanded(child: a)).toList(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class QuickActionItem extends StatelessWidget {
  final Widget icon;
  final Widget label;
  final VoidCallback? onTap;

  const QuickActionItem({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = onTap == null;
    return InkWell(
      onTap: isDisabled ? null : onTap,
      child: Padding(
        padding: .all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ColorFiltered(
              colorFilter: isDisabled
                  ? ColorFilterX.grayscale()
                  : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
              child: icon,
            ),
            const SizedBox(height: 5),
            DefaultTextStyle(
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
                color: isDisabled ? AppColors.gray300 : AppColors.gray900,
              ),
              child: label,
            ),
          ],
        ),
      ),
    );
  }
}

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
            clipBehavior: Clip.antiAlias,
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
                crossAxisAlignment: CrossAxisAlignment.start,
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

  static const double _labelHeight = 14;

  @override
  Widget build(BuildContext context) {
    final isDisabled = onTap == null;
    return InkWell(
      onTap: isDisabled ? null : onTap,
      child: Padding(
        // Tight horizontal padding so 5 labels (esp. WhatsApp) fit one line.
        padding: const EdgeInsets.fromLTRB(2, 12, 2, 12),
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
            SizedBox(
              height: _labelHeight,
              width: double.infinity,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.center,
                child: DefaultTextStyle(
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    height: 1.0,
                    letterSpacing: 0,
                    color: isDisabled ? AppColors.gray300 : AppColors.gray900,
                  ),
                  child: label,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

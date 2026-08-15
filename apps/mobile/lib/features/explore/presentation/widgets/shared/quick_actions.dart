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
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: themeColor.withValues(alpha: 0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
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

/// A contact shortcut that is live only when there is something to open.
///
/// [QuickActionItem] greys itself out when `onTap` is null, and every contact
/// action in the app defeated that: each passed a closure that only discovered
/// inside `launchContactUrl` that the number was missing, and answered the tap
/// with "Não há telefone cadastrado". A clinic with no phone offered Ligar and
/// WhatsApp at full strength, and pressing them was the only way to find out.
///
/// Taking the `Uri?` instead of a callback makes that impossible to get wrong:
/// there is no way to build one of these without deciding whether the target
/// exists.
QuickActionItem contactQuickAction({
  required BuildContext context,
  required IconData icon,
  required Color color,
  required String label,
  required Uri? url,
  required String contactLabel,
  required Future<void> Function(
    BuildContext context, {
    required Uri? url,
    required String contactLabel,
  })
  launch,
}) {
  return QuickActionItem(
    icon: CircleAvatar(
      backgroundColor: color.createSecondary(),
      radius: 18,
      child: Icon(icon, size: 18, color: color),
    ),
    label: Text(label),
    onTap: url == null
        ? null
        : () => launch(context, url: url, contactLabel: contactLabel),
  );
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

  static const double _labelHeight = 16;

  @override
  Widget build(BuildContext context) {
    final isDisabled = onTap == null;
    return InkWell(
      onTap: isDisabled ? null : onTap,
      child: Padding(
        // Tight horizontal padding so 5 labels (esp. WhatsApp) fit one line.
        padding: const EdgeInsets.fromLTRB(2, 14, 2, 14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ColorFiltered(
              colorFilter: isDisabled
                  ? ColorFilterX.grayscale()
                  : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
              child: icon,
            ),
            const SizedBox(height: 6),
            SizedBox(
              height: _labelHeight,
              width: double.infinity,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.center,
                child: DefaultTextStyle(
                  style: TextStyle(
                    fontSize: 12.5,
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

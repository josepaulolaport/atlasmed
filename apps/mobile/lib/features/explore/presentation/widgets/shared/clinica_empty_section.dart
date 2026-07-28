import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/shared/widgets/atlas_button.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicaEmptySection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onAction;
  final Widget? actionLabel;
  final IconData? actionIcon;
  final EdgeInsetsGeometry? margin;

  const ClinicaEmptySection({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.onAction,
    this.actionLabel,
    this.actionIcon,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return ClinicDetailCard(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          CircleAvatar(
            radius: 36,
            backgroundColor: AppColors.navyBright.createSecondary(),
            child: Icon(icon, size: 36, color: AppColors.navyBright),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              height: 1.25,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              height: 1.4,
              fontWeight: FontWeight.w400,
              color: AppColors.gray500,
            ),
          ),
          if (onAction != null && actionLabel != null) ...[
            const SizedBox(height: 12),
            AtlasButton.outline(
              onPressed: onAction!,
              icon: Icon(actionIcon ?? Icons.add_rounded, size: 18),
              label: actionLabel!,
            ),
          ],
        ],
      ),
    );
  }
}

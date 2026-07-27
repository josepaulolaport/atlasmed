import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class SkeletonRow extends StatelessWidget {
  final bool isDoctor;
  const SkeletonRow({super.key, this.isDoctor = false});

  @override
  Widget build(BuildContext context) {
    final avatarBorder = isDoctor ? 22.0 : 12.0;
    return AtlasShimmer(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(avatarBorder),
                color: AppColors.surfaceSecondary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _bar(width: 160, height: 12),
                  const SizedBox(height: 8),
                  _bar(width: 100, height: 10),
                  const SizedBox(height: 8),
                  _bar(width: 200, height: 10),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: AppColors.surfaceSecondary,
      ),
    );
  }
}

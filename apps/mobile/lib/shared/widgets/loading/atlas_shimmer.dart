import 'package:flutter/material.dart';
import 'package:shimmer_animation/shimmer_animation.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Light shimmer wrapper for AtlasMed skeleton placeholders.
class AtlasShimmer extends StatelessWidget {
  const AtlasShimmer({
    super.key,
    required this.child,
    this.enabled = true,
    this.color = Colors.white,
    this.opacity = 0.35,
    this.duration = const Duration(milliseconds: 1400),
    this.interval = const Duration(milliseconds: 180),
    this.direction = const ShimmerDirection.fromLeftToRight(),
  });

  final Widget child;
  final bool enabled;
  final Color color;
  final double opacity;
  final Duration duration;
  final Duration interval;
  final ShimmerDirection direction;

  factory AtlasShimmer.size(Size size) {
    return AtlasShimmer(
      child: Container(
        width: size.width,
        height: size.height,
        decoration: BoxDecoration(
          borderRadius: .all(.circular(16)),
          color: const AppColors.surfaceSecondary,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      enabled: enabled,
      color: color,
      colorOpacity: opacity,
      duration: duration,
      interval: interval,
      direction: direction,
      child: child,
    );
  }
}

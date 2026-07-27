import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Thin wrapper around [AtlasShimmer] that also respects system-level
/// [MediaQuery.disableAnimations].
class Shimmer extends StatelessWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => AtlasShimmer(
    enabled: !MediaQuery.disableAnimationsOf(context),
    child: child,
  );
}

class _SkeletonBar extends StatelessWidget {
  const _SkeletonBar({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: const AppColors.surfaceSecondary,
      borderRadius: BorderRadius.circular(4),
    ),
  );
}

class _ListPlaceholder extends StatelessWidget {
  const _ListPlaceholder({required this.children, this.padding});

  final List<Widget> children;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Shimmer(
    child: Padding(
      padding: padding ?? EdgeInsets.zero,
      child: Column(children: children),
    ),
  );
}

class ReviewListSkeleton extends StatelessWidget {
  const ReviewListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    children: List.generate(
      3,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 2 ? 0 : 10),
        child: _ReviewCardPlaceholder(),
      ),
    ),
  );
}

class _ReviewCardPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const AppColors.surfaceSecondary),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: const AppColors.surfaceSecondary,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SkeletonBar(width: 125, height: 14),
              SizedBox(height: 6),
              _SkeletonBar(width: 130, height: 12),
              SizedBox(height: 8),
              _SkeletonBar(width: 110, height: 11),
            ],
          ),
        ),
        const SizedBox(width: 8),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            _SkeletonBar(width: 58, height: 20),
            SizedBox(height: 12),
            _SkeletonBar(width: 18, height: 18),
          ],
        ),
      ],
    ),
  );
}

class SuggestionListSkeleton extends StatelessWidget {
  const SuggestionListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    children: List.generate(
      3,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 2 ? 0 : 10),
        child: _SuggestionCardPlaceholder(),
      ),
    ),
  );
}

class _SuggestionCardPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const AppColors.surfaceSecondary),
    ),
    child: const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SkeletonBar(width: 155, height: 14),
              SizedBox(height: 7),
              _SkeletonBar(width: 180, height: 12),
              SizedBox(height: 10),
              _SkeletonBar(width: 180, height: 11),
              SizedBox(height: 5),
              _SkeletonBar(width: 135, height: 11),
            ],
          ),
        ),
        SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            _SkeletonBar(width: 58, height: 20),
            SizedBox(height: 12),
            _SkeletonBar(width: 18, height: 18),
          ],
        ),
      ],
    ),
  );
}

class OrderListSkeleton extends StatelessWidget {
  const OrderListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    children: List.generate(
      3,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 2 ? 0 : 12),
        child: _OrderCardPlaceholder(),
      ),
    ),
  );
}

class _OrderCardPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const AppColors.surfaceSecondary),
    ),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SkeletonBar(width: 115, height: 11),
        SizedBox(height: 10),
        _SkeletonBar(width: 190, height: 14),
        SizedBox(height: 5),
        _SkeletonBar(width: 145, height: 12),
        SizedBox(height: 12),
        _SkeletonBar(width: 68, height: 21),
        SizedBox(height: 12),
        Divider(height: 1, color: AppColors.surfaceSecondary),
        SizedBox(height: 11),
        Row(
          children: [
            _SkeletonBar(width: 170, height: 12),
            Spacer(),
            _SkeletonBar(width: 65, height: 15),
          ],
        ),
      ],
    ),
  );
}

class InvitationListSkeleton extends StatelessWidget {
  const InvitationListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    children: List.generate(
      4,
      (index) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SkeletonBar(width: 155, height: 15),
            const SizedBox(height: 6),
            const _SkeletonBar(width: 210, height: 13),
            const SizedBox(height: 8),
            const Row(
              children: [
                _SkeletonBar(width: 64, height: 20),
                SizedBox(width: 6),
                _SkeletonBar(width: 62, height: 20),
              ],
            ),
            const SizedBox(height: 7),
            const _SkeletonBar(width: 200, height: 11),
            if (index != 3) const SizedBox(height: 14),
            if (index != 3) const Divider(height: 1, color: AppColors.surfaceSecondary),
          ],
        ),
      ),
    ),
  );
}

class ProductListSkeleton extends StatelessWidget {
  const ProductListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
    children: List.generate(
      5,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 4 ? 0 : 8),
        child: _ProductRowPlaceholder(),
      ),
    ),
  );
}

class _ProductRowPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const AppColors.surfaceSecondary),
    ),
    child: const Row(
      children: [
        _SkeletonIconBox(size: 40, radius: 10),
        SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SkeletonBar(width: 125, height: 14),
              SizedBox(height: 6),
              _SkeletonBar(width: 100, height: 11),
            ],
          ),
        ),
        SizedBox(width: 8),
        _SkeletonBar(width: 58, height: 13),
        SizedBox(width: 6),
        _SkeletonBar(width: 18, height: 18),
      ],
    ),
  );
}

class CompetitorListSkeleton extends StatelessWidget {
  const CompetitorListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
    children: List.generate(
      4,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 3 ? 0 : 8),
        child: _CompetitorRowPlaceholder(),
      ),
    ),
  );
}

class _CompetitorRowPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const AppColors.surfaceSecondary),
    ),
    child: const Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SkeletonBar(width: 165, height: 13),
              SizedBox(height: 6),
              _SkeletonBar(width: 145, height: 11),
            ],
          ),
        ),
        SizedBox(width: 8),
        _SkeletonBar(width: 58, height: 13),
        SizedBox(width: 16),
        _SkeletonBar(width: 18, height: 18),
      ],
    ),
  );
}

class CompetitorPickerListSkeleton extends StatelessWidget {
  const CompetitorPickerListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
    children: List.generate(
      3,
      (index) => Padding(
        padding: EdgeInsets.only(bottom: index == 2 ? 0 : 6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const AppColors.background,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SkeletonBar(width: 160, height: 13),
                    SizedBox(height: 6),
                    _SkeletonBar(width: 140, height: 11),
                  ],
                ),
              ),
              _SkeletonBar(width: 20, height: 20),
            ],
          ),
        ),
      ),
    ),
  );
}

class UserPickerListSkeleton extends StatelessWidget {
  const UserPickerListSkeleton({super.key});

  @override
  Widget build(BuildContext context) => _ListPlaceholder(
    padding: const EdgeInsets.symmetric(vertical: 6),
    children: List.generate(
      5,
      (index) => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        child: Row(
          children: [
            _SkeletonIconBox(size: 40, radius: 20),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SkeletonBar(width: 150, height: 14),
                  SizedBox(height: 6),
                  _SkeletonBar(width: 100, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _SkeletonIconBox extends StatelessWidget {
  const _SkeletonIconBox({required this.size, required this.radius});

  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: const AppColors.surfaceSecondary,
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}

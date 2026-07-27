import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Horizontal snapping roster strip with a trailing shimmer card only while a
/// next page is being requested.
class FacilityRosterPageView extends StatefulWidget {
  const FacilityRosterPageView({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    required this.height,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.onLoadMore,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double height;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  @override
  State<FacilityRosterPageView> createState() => _FacilityRosterPageViewState();
}

class _FacilityRosterPageViewState extends State<FacilityRosterPageView> {
  final ScrollController _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!widget.hasMore ||
        widget.isLoadingMore ||
        widget.onLoadMore == null ||
        !_controller.hasClients) {
      return;
    }
    final position = _controller.position;
    if (position.pixels >= position.maxScrollExtent - 48) {
      widget.onLoadMore!();
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final cardWidth = screenWidth * 0.86;
    final trailing = widget.hasMore ? 1 : 0;

    return SizedBox(
      height: widget.height,
      child: ListView.builder(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        itemCount: widget.itemCount + trailing,
        itemBuilder: (context, index) {
          if (index >= widget.itemCount) {
            return Padding(
              padding: const EdgeInsets.only(right: 20, left: 6),
              child: SizedBox(
                width: cardWidth,
                child: widget.isLoadingMore
                    ? const FacilityRosterPaginationSkeleton()
                    : const SizedBox.shrink(),
              ),
            );
          }

          return Padding(
            padding: EdgeInsets.only(
              left: index == 0 ? 20 : 6,
              right: index == widget.itemCount - 1 && !widget.hasMore ? 20 : 6,
            ),
            child: SizedBox(
              width: cardWidth,
              child: widget.itemBuilder(context, index),
            ),
          );
        },
      ),
    );
  }
}

class FacilityRosterPaginationSkeleton extends StatelessWidget {
  const FacilityRosterPaginationSkeleton({super.key});

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: AtlasShimmer(
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceSecondary,
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(14),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _RosterSkeletonBlock(width: 42, height: 42, radius: 10),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _RosterSkeletonBlock(width: 120, height: 12),
                      SizedBox(height: 6),
                      _RosterSkeletonBlock(width: 88, height: 10),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            _RosterSkeletonBlock(width: double.infinity, height: 1),
            SizedBox(height: 12),
            _RosterSkeletonBlock(width: 156, height: 10),
            SizedBox(height: 10),
            _RosterSkeletonBlock(width: 128, height: 10),
            Spacer(),
            _RosterSkeletonBlock(width: double.infinity, height: 1),
            SizedBox(height: 10),
            _RosterSkeletonBlock(width: 104, height: 11),
          ],
        ),
      ),
    ),
  );
}

class _RosterSkeletonBlock extends StatelessWidget {
  const _RosterSkeletonBlock({
    required this.width,
    required this.height,
    this.radius = 4,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        color: AppColors.surfaceSecondary,
      ),
    );
  }
}

import 'package:flutter/material.dart';

/// Horizontal snapping roster strip with a compact trailing load-more indicator
/// placed after the last card (not inside a card).
class FacilityRosterPageView extends StatefulWidget {
  const FacilityRosterPageView({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    required this.height,
    this.hasMore = false,
    this.onLoadMore,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double height;
  final bool hasMore;
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
    if (!widget.hasMore || widget.onLoadMore == null) return;
    if (!_controller.hasClients) return;
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
            // Compact spinner after the last card — not a card itself.
            return const Padding(
              padding: EdgeInsets.only(right: 16),
              child: SizedBox(
                width: 48,
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                ),
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

import 'package:flutter/material.dart';

class UsersEmptyState extends StatelessWidget {
  const UsersEmptyState({super.key, this.query = ''});

  final String query;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: Color(0xFFf3f4f6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.people_outline_rounded,
                size: 32,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              query.isNotEmpty
                  ? 'Nada encontrado para "$query"'
                  : 'Nenhum usuário encontrado',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              query.isNotEmpty
                  ? 'Tente outra busca ou remova alguns filtros.'
                  : 'Convide alguém para começar.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF6b7280),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class UsersSkeletonRow extends StatelessWidget {
  const UsersSkeletonRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFeef0f3),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                _UsersSkeletonBar(width: 160, height: 12),
                SizedBox(height: 8),
                _UsersSkeletonBar(width: 120, height: 10),
                SizedBox(height: 8),
                _UsersSkeletonBar(width: 90, height: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A user-row-shaped shimmer shown only while the following page is loading.
class UsersPaginationSkeletonRow extends StatefulWidget {
  const UsersPaginationSkeletonRow({super.key});

  @override
  State<UsersPaginationSkeletonRow> createState() =>
      _UsersPaginationSkeletonRowState();
}

class _UsersPaginationSkeletonRowState extends State<UsersPaginationSkeletonRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _shimmerController.stop();
    } else if (!_shimmerController.isAnimating) {
      _shimmerController.repeat();
    }
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: _shimmerController,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: const [
              Color(0xFFeef0f3),
              Color(0xFFf8fafc),
              Color(0xFFeef0f3),
            ],
            stops: const [0.25, 0.5, 0.75],
            transform: _UsersSlidingGradientTransform(_shimmerController.value),
          ).createShader(bounds),
          child: child,
        ),
        child: const UsersSkeletonRow(),
      ),
    );
  }
}

class _UsersSkeletonBar extends StatelessWidget {
  const _UsersSkeletonBar({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        color: const Color(0xFFeef0f3),
      ),
    );
  }
}

class _UsersSlidingGradientTransform extends GradientTransform {
  const _UsersSlidingGradientTransform(this.slidePercent);

  final double slidePercent;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(
      (slidePercent * 2 - 1) * bounds.width,
      0,
      0,
    );
  }
}

import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.people_outline_rounded,
                size: 32,
                color: AppColors.gray400,
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
                color: AppColors.gray900,
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
                color: AppColors.gray500,
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
        border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surfaceSecondary,
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
class UsersPaginationSkeletonRow extends StatelessWidget {
  const UsersPaginationSkeletonRow({super.key});

  @override
  Widget build(BuildContext context) =>
      const ExcludeSemantics(child: AtlasShimmer(child: UsersSkeletonRow()));
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
        color: AppColors.surfaceSecondary,
      ),
    );
  }
}

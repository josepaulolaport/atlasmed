import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Produtos em uso" — revenue, trend and share-of-clinic per product.
/// Empty until backend aggregation from `orders` is wired (Phase 2).
class ClinicProductsSection extends StatelessWidget {
  const ClinicProductsSection({super.key, required this.products});

  final List<ProductUsage> products;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const ClinicaEmptySection(
        icon: Icons.inventory_2_outlined,
        title: 'Nenhum produto em uso',
        description:
            'Produtos aparecerão aqui quando houver pedidos registrados.',
      );
    }

    return ClinicDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, product) in products.indexed) ...[
            if (i > 0) const SizedBox(height: 16),
            _ProductRow(product: product),
          ],
        ],
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({required this.product});

  final ProductUsage product;

  @override
  Widget build(BuildContext context) {
    final trendColor = product.isTrendingUp ? AppColors.green : AppColors.red;
    final trendIcon = product.isTrendingUp
        ? Icons.trending_up_rounded
        : Icons.trending_down_rounded;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                product.name,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
            Text(
              'R\$ ${product.revenueLast6m.toStringAsFixed(0)} / 6m',
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            const SizedBox(width: 8),
            Icon(trendIcon, size: 14, color: trendColor),
            Text(
              '${product.trendPercent.abs().toStringAsFixed(0)}%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: trendColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: (product.sharePercent / 100).clamp(0, 1),
                  minHeight: 6,
                  backgroundColor: AppColors.gray100,
                  valueColor: const AlwaysStoppedAnimation(
                    AppColors.navyBright,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '${product.sharePercent.toStringAsFixed(0)}%',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.navyBright,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        const Text(
          'Share na clínica',
          style: TextStyle(fontSize: 10.5, color: AppColors.gray400),
        ),
      ],
    );
  }
}

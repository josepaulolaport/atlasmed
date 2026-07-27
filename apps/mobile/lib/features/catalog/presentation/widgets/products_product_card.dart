import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/mock/mock_products_data.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Compact family card for the Produtos list — brand-level intro only.
/// Concentrations and pricing live on the detail screen.
class ProductsProductCard extends StatelessWidget {
  final MockProductFamily family;
  final VoidCallback? onTap;

  const ProductsProductCard({super.key, required this.family, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFeef0f3)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFeef0f3)),
                ),
                child: const Icon(
                  Icons.medication_liquid_outlined,
                  size: 34,
                  color: AppColors.gray300,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      family.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navyDeep,
                        letterSpacing: -0.1,
                      ),
                    ),
                    if (family.manufacturer.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      _MetaLine(
                        caption: 'Fabricante',
                        value: family.manufacturer,
                      ),
                    ],
                    if (family.countryOfOrigin.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      _MetaLine(
                        caption: 'País de origem',
                        value: family.countryOfOrigin,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.gray400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaLine extends StatelessWidget {
  final String caption;
  final String value;

  const _MetaLine({required this.caption, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          '$caption: ',
          style: const TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray400,
          ),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: AppColors.gray500,
            ),
          ),
        ),
      ],
    );
  }
}

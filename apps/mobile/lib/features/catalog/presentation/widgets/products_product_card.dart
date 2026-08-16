import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Compact family card for the Produtos list — brand-level introduction with
/// presentation count and the lowest current price. The selected presentation
/// and its full pricing live on the detail screen.
class ProductsProductCard extends StatelessWidget {
  final CatalogFamily family;
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
            border: Border.all(color: AppColors.surfaceSecondary),
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
              // No thumbnail. `CatalogFamily` has no image field and never
              // has, so this was a 72pt grey pill icon repeated down the
              // list — a quarter of the card's width spent on nothing, and
              // the reason every product name was cut off after one line.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      family.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.25,
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
                    const SizedBox(height: 6),
                    Text(
                      '${family.variants.length} ${family.variants.length == 1 ? 'apresentação' : 'apresentações'} · a partir de ${brl(family.minPrice)}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                    ),
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

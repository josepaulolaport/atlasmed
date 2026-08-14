import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/variant_info_card.dart';
import 'package:atlasmed_mobile_app/features/orders/presentation/widgets/order_widgets.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// API-backed product family detail. [familyId] is seeded with a variant id
/// from [CatalogFamily.id], but accepts any variant id in the family so a
/// direct link remains valid if the API returns its presentations reordered.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.familyId});

  final int familyId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int? _selectedVariantId;

  CatalogVariant _selectedVariant(CatalogFamily family) {
    final selectedId = _selectedVariantId ?? widget.familyId;
    return family.variants.firstWhere(
      (variant) => variant.id == selectedId,
      orElse: () => family.variants.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    final familiesAsync = ref.watch(catalogFamiliesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: familiesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _DetailError(
            onRetry: () => ref.invalidate(catalogFamiliesProvider),
          ),
          data: (families) {
            final family = _familyById(families);
            if (family == null) return const _DetailError();
            final variant = _selectedVariant(family);

            return Column(
              children: [
                _Header(title: family.name),
                if (family.variants.length > 1)
                  _PresentationSwitcher(
                    variants: family.variants,
                    selectedId: variant.id,
                    onSelected: (id) => setState(() => _selectedVariantId = id),
                  ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      VariantInfoCard(
                        variant: variant,
                        onViewComparison: () => CatalogComparisonRoute(
                          variantId: variant.id,
                        ).push(context),
                      ),
                      const SizedBox(height: 12),
                      _PublicationCard(family: family),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  CatalogFamily? _familyById(List<CatalogFamily> families) {
    for (final family in families) {
      if (family.variants.any((variant) => variant.id == widget.familyId)) {
        return family;
      }
    }
    return null;
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 8, 16, 4),
    child: Row(
      children: [
        BackChevron(onTap: () => context.pop()),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDeep,
            ),
          ),
        ),
      ],
    ),
  );
}

class _PresentationSwitcher extends StatelessWidget {
  const _PresentationSwitcher({
    required this.variants,
    required this.selectedId,
    required this.onSelected,
  });

  final List<CatalogVariant> variants;
  final int selectedId;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
    child: Row(
      children: [
        for (final variant in variants)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(variant.comparisonLabel),
              selected: variant.id == selectedId,
              onSelected: (_) => onSelected(variant.id),
            ),
          ),
      ],
    ),
  );
}

class _PublicationCard extends StatelessWidget {
  const _PublicationCard({required this.family});

  final CatalogFamily family;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.surfaceSecondary),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'PUBLICAÇÃO',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.navyDeep,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Brasíndice: ${family.brasindicePublishedAt == null ? '—' : formatDate(family.brasindicePublishedAt!)}',
        ),
        const SizedBox(height: 2),
        Text(
          'Simpro: ${family.simproPublishedAt == null ? '—' : formatDate(family.simproPublishedAt!)}',
        ),
      ],
    ),
  );
}

class _DetailError extends StatelessWidget {
  const _DetailError({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const _Header(title: 'Produto'),
      Expanded(
        child: CatalogErrorState(
          message: onRetry == null
              ? 'Produto não encontrado'
              : 'Não foi possível carregar',
          onRetry: onRetry ?? () => context.pop(),
        ),
      ),
    ],
  );
}

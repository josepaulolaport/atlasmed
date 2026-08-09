import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/manage_competitors_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/variant_form_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/variant_info_card.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart'
    show isAdminProvider;
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Entry point for the Catálogo de Produtos section, designed like a store
/// catalog rather than a filing cabinet: a search box and a family filter
/// (via the search bar's filter button) narrow one flat, scannable list of
/// every product below — there is no folder to open, family is just a
/// filter. Tapping a product opens a quick-view sheet with its full detail
/// instead of a new screen.
class CatalogHomeScreen extends ConsumerStatefulWidget {
  const CatalogHomeScreen({super.key});

  @override
  ConsumerState<CatalogHomeScreen> createState() => _CatalogHomeScreenState();
}

class _CatalogHomeScreenState extends ConsumerState<CatalogHomeScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  ProductFilterSelection _filter = const ProductFilterSelection();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<(CatalogVariant, CatalogFamily)> _filtered(
    List<CatalogFamily> families,
  ) {
    final query = _query.trim().toLowerCase();
    final all = <(CatalogVariant, CatalogFamily)>[
      for (final family in families)
        for (final variant in family.variants) (variant, family),
    ];
    return all.where((entry) {
      final (variant, family) = entry;
      if (_filter.familyId != null && family.id != _filter.familyId) {
        return false;
      }
      if (_filter.manufacturer != null &&
          variant.manufacturer != _filter.manufacturer) {
        return false;
      }
      if (_filter.country != null &&
          variant.countryOfOrigin != _filter.country) {
        return false;
      }
      if (query.isEmpty) return true;
      return variant.name.toLowerCase().contains(query);
    }).toList();
  }

  void _openFilterSheet(List<CatalogFamily> families) {
    final manufacturers = <String>{
      for (final family in families)
        for (final variant in family.variants) variant.manufacturer,
    }.toList()..sort();
    final countries = <String>{
      for (final family in families)
        for (final variant in family.variants) variant.countryOfOrigin,
    }.toList()..sort();

    showProductFilterSheet(
      context,
      families: families,
      manufacturers: manufacturers,
      countries: countries,
      selection: _filter,
      onApply: (selection) => setState(() => _filter = selection),
    );
  }

  void _openQuickView(
    CatalogVariant variant,
    CatalogFamily family,
    List<CatalogFamily> families,
  ) {
    final isAdmin = ref.read(isAdminProvider);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _VariantQuickView(
        variant: variant,
        family: family,
        onViewComparison: () {
          Navigator.pop(sheetContext);
          CatalogComparisonRoute(variantId: variant.id).push(context);
        },
        onEdit: !isAdmin
            ? null
            : () {
                Navigator.pop(sheetContext);
                VariantFormScreen.show(
                  context,
                  existing: variant,
                  families: families,
                );
              },
        onManageCompetitors: !isAdmin
            ? null
            : () {
                Navigator.pop(sheetContext);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ManageCompetitorsScreen(
                      variantId: variant.id,
                      variantLabel: variant.comparisonLabel,
                    ),
                  ),
                );
              },
      ),
    );
  }

  Future<void> _openNewProductForm(List<CatalogFamily> families) async {
    final created = await VariantFormScreen.show(context, families: families);
    if (created == null) return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${created.name} adicionado ao catálogo')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final familiesAsync = ref.watch(catalogFamiliesProvider);
    final isAdmin = ref.watch(isAdminProvider);
    final families = familiesAsync.valueOrNull ?? const [];

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: isAdmin
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Novo produto'),
              onPressed: () => _openNewProductForm(families),
            )
          : null,
      appBar: AtlasAppBar(
        page: 'Catálogo',
        actions: [
          if (isAdmin)
            IconButton(
              tooltip: 'Campos de potencial',
              icon: const Icon(Icons.insights_outlined),
              onPressed: () => const CatalogPotentialDefinitionsRoute().push(context),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const CatalogTabBar(active: CatalogTab.produtos),
            CatalogSearchBar(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              filterCount: _filter.activeCount,
              onFilter: () =>
                  _openFilterSheet(familiesAsync.valueOrNull ?? const []),
            ),
            Expanded(
              child: familiesAsync.when(
                loading: () => const ProductListSkeleton(),
                error: (error, _) => CatalogErrorState(
                  onRetry: () => ref.invalidate(catalogFamiliesProvider),
                ),
                data: (families) {
                  final entries = _filtered(families);
                  return entries.isEmpty
                      ? const Center(
                          child: Text(
                            'Nenhum produto encontrado',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: AppColors.gray400,
                            ),
                          ),
                        )
                      : ListView.separated(
                          physics: const BouncingScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                          itemCount: entries.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final (variant, family) = entries[index];
                            return _ProductRow(
                              variant: variant,
                              onTap: () =>
                                  _openQuickView(variant, family, families),
                            );
                          },
                        );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One row in the flat product list — compact enough to scan many products
/// quickly: icon, name/presentation, price, chevron. Tap for the full
/// detail in a quick-view sheet.
class _ProductRow extends StatelessWidget {
  final CatalogVariant variant;
  final VoidCallback onTap;

  const _ProductRow({required this.variant, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.medication_liquid_outlined,
                  size: 20,
                  color: AppColors.navyDeep,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      variant.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                        letterSpacing: -0.1,
                      ),
                    ),
                    if (variant.presentation.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        variant.presentation,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                brl(variant.price),
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDeep,
                ),
              ),
              const SizedBox(width: 2),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.gray400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Quick-view sheet opened by tapping a [_ProductRow] — the full detail
/// (thumbnail, price, SIMPRO/BRASÍNDICE/TISS codes, publication dates, the
/// link to the comparativo) without leaving the list behind: dismiss it and
/// you're right back where you were, ready to tap the next product.
class _VariantQuickView extends StatelessWidget {
  final CatalogVariant variant;
  final CatalogFamily family;
  final VoidCallback onViewComparison;
  final VoidCallback? onEdit;
  final VoidCallback? onManageCompetitors;

  const _VariantQuickView({
    required this.variant,
    required this.family,
    required this.onViewComparison,
    this.onEdit,
    this.onManageCompetitors,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 4),
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray200,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              VariantInfoCard(
                variant: variant,
                bordered: false,
                onViewComparison: onViewComparison,
                onEdit: onEdit,
                onManageCompetitors: onManageCompetitors,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: _PublicationFooter(
                  brasindiceDate: family.brasindicePublishedAt,
                  simproDate: family.simproPublishedAt,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small label/value panel showing when the Brasíndice/Simpro tables for
/// this product's family were last published — styled like the codes panel
/// in [VariantInfoCard] so it reads as part of the same product detail.
class _PublicationFooter extends StatelessWidget {
  final DateTime brasindiceDate;
  final DateTime simproDate;

  const _PublicationFooter({
    required this.brasindiceDate,
    required this.simproDate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PUBLICAÇÃO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Brasíndice: ${formatDate(brasindiceDate)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
                  ),
                ),
                Text(
                  'Simpro: ${formatDate(simproDate)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => showComingSoonSnack(context, 'Editar publicação'),
            icon: const Icon(
              Icons.edit_outlined,
              size: 16,
              color: AppColors.gray400,
            ),
          ),
        ],
      ),
    );
  }
}

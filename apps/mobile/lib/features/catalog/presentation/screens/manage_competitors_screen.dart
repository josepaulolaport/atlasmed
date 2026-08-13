import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/comparison_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/competitor_form_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Admin-only screen for managing which competitor products are linked to
/// one AtlasMed variant's "comparativo" (`product_equivalences`). Linking
/// and unlinking here is what makes a competitor show up — or stop
/// showing up — in [CatalogComparisonScreen] for this product; it never
/// deletes the competitor product itself, since the same competitor can
/// be equivalent to several AtlasMed variants at once.
class ManageCompetitorsScreen extends ConsumerWidget {
  final int variantId;
  final String variantLabel;

  const ManageCompetitorsScreen({
    super.key,
    required this.variantId,
    required this.variantLabel,
  });

  Future<void> _unlink(
    BuildContext context,
    WidgetRef ref,
    ComparisonRow row,
  ) async {
    try {
      await ref
          .read(catalogRepositoryProvider)
          .unlinkCompetitor(variantId, row.id);
      invalidateCatalog(ref, variantId: variantId);
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is CatalogApiException
                ? error.message
                : 'Não foi possível remover a marca.',
          ),
        ),
      );
    }
  }

  Future<void> _openAddCompetitorSheet(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final unlinked = ref.read(catalogUnlinkedCompetitorsProvider(variantId));
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) => _AddCompetitorSheet(
        variantId: variantId,
        initialUnlinked: unlinked.valueOrNull ?? const [],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final comparisonAsync = ref.watch(catalogComparisonProvider(variantId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.gray950,
        title: const Text(
          'Gerenciar outras marcas',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  variantLabel.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            Expanded(
              child: comparisonAsync.when(
                loading: () => const CompetitorListSkeleton(),
                error: (error, _) => CatalogErrorState(
                  onRetry: () =>
                      ref.invalidate(catalogComparisonProvider(variantId)),
                ),
                data: (group) {
                  final competitors = group.rows
                      .where((row) => !row.isOwn)
                      .toList();
                  if (competitors.isEmpty) {
                    return const Center(
                      child: Text(
                        'Nenhuma outra marca cadastrada ainda',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    itemCount: competitors.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final row = competitors[index];
                      return _CompetitorRow(
                        row: row,
                        onRemove: () => _unlink(context, ref, row),
                      );
                    },
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () => _openAddCompetitorSheet(context, ref),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text(
                    'Adicionar outra marca',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.navyDeep,
                    side: const BorderSide(color: AppColors.navyDeep),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompetitorRow extends StatelessWidget {
  final ComparisonRow row;
  final VoidCallback onRemove;

  const _CompetitorRow({required this.row, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${row.manufacturer} · ${row.countryOfOrigin}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.gray400,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            brl(row.price20),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: AppColors.navyDeep,
            ),
          ),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(
              Icons.link_off_rounded,
              size: 18,
              color: AppColors.gray400,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet opened by "Adicionar outra marca" — either pick an
/// already-registered competitor product not yet linked to this variant,
/// or register a brand-new one (which gets linked automatically once
/// saved).
class _AddCompetitorSheet extends ConsumerStatefulWidget {
  final int variantId;
  final List<CompetitorProduct> initialUnlinked;

  const _AddCompetitorSheet({
    required this.variantId,
    required this.initialUnlinked,
  });

  @override
  ConsumerState<_AddCompetitorSheet> createState() =>
      _AddCompetitorSheetState();
}

class _AddCompetitorSheetState extends ConsumerState<_AddCompetitorSheet> {
  bool _linking = false;

  void _showLinkError(Object error) {
    if (!mounted) return;
    setState(() => _linking = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error is CatalogApiException
              ? error.message
              : 'Não foi possível vincular a marca.',
        ),
      ),
    );
  }

  Future<void> _linkExisting(CompetitorProduct competitor) async {
    if (_linking) return;
    setState(() => _linking = true);
    try {
      await ref
          .read(catalogRepositoryProvider)
          .linkCompetitor(widget.variantId, competitor.id);
      invalidateCatalog(ref, variantId: widget.variantId);
      if (mounted) Navigator.pop(context);
    } catch (error) {
      _showLinkError(error);
    }
  }

  Future<void> _createAndLink() async {
    final created = await CompetitorFormScreen.show(context);
    if (created == null) return;
    if (!mounted) return;
    setState(() => _linking = true);
    try {
      await ref
          .read(catalogRepositoryProvider)
          .linkCompetitor(widget.variantId, created.id);
      invalidateCatalog(ref, variantId: widget.variantId);
      if (mounted) Navigator.pop(context);
    } catch (error) {
      _showLinkError(error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unlinkedAsync = ref.watch(
      catalogUnlinkedCompetitorsProvider(widget.variantId),
    );

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
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
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 10, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'ADICIONAR CONCORRENTE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _linking ? null : _createAndLink,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text(
                    'Cadastrar nova marca',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.navyDeep,
                    side: const BorderSide(color: AppColors.navyDeep),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
            Flexible(
              child: unlinkedAsync.when(
                loading: () => const CompetitorPickerListSkeleton(),
                error: (_, _) => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: Text('Não foi possível carregar outras marcas'),
                  ),
                ),
                data: (unlinked) {
                  if (unlinked.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.fromLTRB(20, 8, 20, 24),
                      child: Text(
                        'Todas as outras marcas cadastradas já estão '
                        'vinculadas a este produto.',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    );
                  }
                  return ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    itemCount: unlinked.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      final competitor = unlinked[index];
                      return Material(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: _linking
                              ? null
                              : () => _linkExisting(competitor),
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        competitor.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.gray900,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${competitor.manufacturer} · '
                                        '${competitor.countryOfOrigin}',
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.gray400,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.add_circle_outline_rounded,
                                  size: 20,
                                  color: AppColors.navyBright,
                                ),
                              ],
                            ),
                          ),
                        ),
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

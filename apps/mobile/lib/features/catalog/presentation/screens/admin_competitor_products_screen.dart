import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/competitor_form_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';

/// `Administração › Produtos concorrentes` (spec 0016 §4.3) — the competitors'
/// products, listed on their own so they can be registered and corrected without
/// going through one of ours.
///
/// **Equivalences are not edited here.** They are written in one direction only:
/// from our product to the competitor's, in `ManageCompetitorsScreen`. An earlier
/// draft offered the reverse as a second entry point; it was removed because an
/// equivalence *is* a statement about one of our products ("this is what
/// competes with it"), and two places to make the same statement is how the two
/// come to disagree.
///
/// The list still marks a product with no equivalence, because that is the one a
/// rep cannot record quantities for (spec 0013 §7) — it just sends the admin to
/// our product to fix it.
class AdminCompetitorProductsScreen extends ConsumerStatefulWidget {
  const AdminCompetitorProductsScreen({super.key});

  @override
  ConsumerState<AdminCompetitorProductsScreen> createState() =>
      _AdminCompetitorProductsScreenState();
}

class _AdminCompetitorProductsScreenState
    extends ConsumerState<AdminCompetitorProductsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CompetitorProduct> _filtered(List<CompetitorProduct> all) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return all;
    return all.where((competitor) {
      return competitor.name.toLowerCase().contains(query) ||
          competitor.manufacturer.toLowerCase().contains(query) ||
          (competitor.brand ?? '').toLowerCase().contains(query);
    }).toList();
  }

  Future<void> _openForm({CompetitorProduct? existing}) async {
    final saved = await CompetitorFormScreen.show(context, existing: existing);
    if (saved == null) return;
    if (!mounted) return;
    ref.invalidate(adminAllCompetitorsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          existing == null
              ? '${saved.name} registrado'
              : '${saved.name} atualizado',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final competitorsAsync = ref.watch(adminAllCompetitorsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Concorrentes'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.navyDeep,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Novo produto'),
        onPressed: _openForm,
      ),
      body: SafeArea(
        child: Column(
          children: [
            CatalogSearchBar(
              controller: _searchController,
              hintText: 'Buscar produto…',
              onChanged: (value) => setState(() => _query = value),
              filterCount: 0,
              onFilter: () {},
            ),
            Expanded(
              child: competitorsAsync.when(
                loading: () => const ProductListSkeleton(),
                error: (_, _) => CatalogErrorState(
                  onRetry: () =>
                      ref.invalidate(adminAllCompetitorsProvider),
                ),
                data: (all) {
                  final competitors = _filtered(all);
                  if (competitors.isEmpty) {
                    return const Center(
                      child: Text(
                        'Nenhum produto concorrente encontrado',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    );
                  }
                  return ListView.separated(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: competitors.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final competitor = competitors[index];
                      return _CompetitorRow(
                        competitor: competitor,
                        // Straight into the form. A row has one thing to do —
                        // edit it — so an intermediate action sheet is a tap
                        // that buys nothing.
                        onTap: () => _openForm(existing: competitor),
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

class _CompetitorRow extends StatelessWidget {
  const _CompetitorRow({required this.competitor, required this.onTap});

  final CompetitorProduct competitor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      if ((competitor.brand ?? '').isNotEmpty) competitor.brand!,
      if (competitor.manufacturer.isNotEmpty) competitor.manufacturer,
    ].join(' · ');
    // A competitor product equivalent to nothing is one a rep cannot record
    // quantities for
    // (spec 0013 §7). Finding those by opening every row in turn is not a
    // workflow, so the list says it.
    final unmapped = competitor.equivalenceCount == 0;

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
                  color: AppColors.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.storefront_outlined,
                  size: 20,
                  color: AppColors.gray700,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            competitor.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: competitor.isActive
                                  ? AppColors.gray900
                                  : AppColors.gray400,
                              letterSpacing: -0.1,
                            ),
                          ),
                        ),
                        if (!competitor.isActive) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSecondary,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Inativo',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.gray700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    ],
                    if (unmapped) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(
                            Icons.link_off_rounded,
                            size: 12,
                            color: AppColors.error,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Sem produto equivalente',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                brl(competitor.price20),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/competitor_form_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/subscreen_app_bar.dart';
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
    showCatalogSnack(
      context,
      existing == null
          ? '${saved.name} registrado'
          : '${saved.name} atualizado',
    );
  }

  @override
  Widget build(BuildContext context) {
    final competitorsAsync = ref.watch(adminAllCompetitorsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const SubscreenAppBar(title: 'Produtos concorrentes'),
      // Nothing to add to a list that could not load — see the products screen.
      floatingActionButton: competitorsAsync.hasError
          ? null
          : FloatingActionButton.extended(
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
            ),
            Expanded(
              child: competitorsAsync.when(
                loading: () => const ProductListSkeleton(),
                error: (_, _) => CatalogErrorState(
                  onRetry: () => ref.invalidate(adminAllCompetitorsProvider),
                ),
                data: (all) {
                  final competitors = _filtered(all);
                  if (competitors.isEmpty) {
                    return _query.trim().isNotEmpty
                        ? CatalogEmptyState.noResults(
                            query: _query.trim(),
                            onClear: () => setState(() {
                              _query = '';
                              _searchController.clear();
                            }),
                          )
                        : const CatalogEmptyState(
                            icon: Icons.storefront_outlined,
                            title: 'Nenhum produto concorrente ainda',
                            subtitle:
                                'Toque em “Novo produto” para cadastrar o '
                                'primeiro. Depois vincule-o a um produto '
                                'nosso para que apareça no comparativo.',
                          );
                  }
                  return RefreshIndicator(
                    color: AppColors.navyDeep,
                    onRefresh: () async =>
                        ref.invalidate(adminAllCompetitorsProvider),
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: competitors.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final competitor = competitors[index];
                        final subtitle = [
                          if ((competitor.brand ?? '').isNotEmpty)
                            competitor.brand!,
                          if (competitor.manufacturer.isNotEmpty)
                            competitor.manufacturer,
                        ].join(' · ');
                        return CatalogListRow(
                          leading: const CatalogRowIcon(
                            icon: Icons.storefront_outlined,
                          ),
                          title: competitor.name,
                          subtitle: subtitle,
                          isActive: competitor.isActive,
                          // A competitor product equivalent to nothing is one a
                          // rep cannot record quantities for (spec 0013 §7).
                          // Finding those by opening every row in turn is not a
                          // workflow, so the list says it.
                          warning: competitor.equivalenceCount == 0
                              ? 'Sem produto equivalente'
                              : null,
                          trailing: Text(
                            brl(competitor.price20),
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.navyDeep,
                            ),
                          ),
                          // Straight into the form. A row has one thing to do —
                          // edit it — so an intermediate action sheet is a tap
                          // that buys nothing.
                          onTap: () => _openForm(existing: competitor),
                        );
                      },
                    ),
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

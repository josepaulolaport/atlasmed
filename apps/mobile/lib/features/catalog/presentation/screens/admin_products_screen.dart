import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/variant_form_screen.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/product_thumbnail.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart'
    show isAdminProvider;
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// `Administração › Produtos` (spec 0016 §4.2) — the admin's flat list of
/// every product of ours, with create, edit and "produtos concorrentes"
/// behind it.
///
/// A search box and a family filter (via the search bar's filter button)
/// narrow one flat, scannable list — there is no folder to open, family is
/// just a filter. Tapping a product opens a quick-view sheet with its full
/// detail instead of a new screen.
///
/// This screen used to be `CatalogHomeScreen` at `/catalog`, a route nothing
/// in the app linked to — its only inbound link was the tab bar it rendered
/// itself. Spec 0016 §1.1 found it unreachable and §3.4 retired that route in
/// favour of this one. The rep-facing browse surface is `/products`
/// (`ProductsHomeScreen`); this is the editing surface, and per §6.4 there is
/// exactly one of those.
class AdminProductsScreen extends ConsumerStatefulWidget {
  const AdminProductsScreen({super.key});

  @override
  ConsumerState<AdminProductsScreen> createState() =>
      _AdminProductsScreenState();
}

class _AdminProductsScreenState extends ConsumerState<AdminProductsScreen> {
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

  /// Straight into the form.
  ///
  /// This used to open a quick-view sheet with an "editar" button inside it —
  /// the same sheet the rep-facing product list uses. On the admin panel that
  /// was a tap that bought nothing: the one thing to do with a row here is
  /// edit it, and the sheet showed a read-only copy of the first screenful of
  /// the form it was hiding.
  Future<void> _openEditor(
    CatalogVariant variant,
    List<CatalogFamily> families,
  ) async {
    final saved = await VariantFormScreen.show(
      context,
      existing: variant,
      families: families,
    );
    if (saved == null || !mounted) return;
    showCatalogSnack(context, '${saved.name} atualizado');
  }

  Future<void> _openNewProductForm(List<CatalogFamily> families) async {
    final created = await VariantFormScreen.show(context, families: families);
    if (created == null) return;
    if (!mounted) return;
    showCatalogSnack(context, '${created.name} adicionado ao catálogo');
  }

  @override
  Widget build(BuildContext context) {
    // Inactive products included (spec 0016 §4): the panel is the one place you
    // go *because* something is retired and you want it back.
    final familiesAsync = ref.watch(adminCatalogFamiliesProvider);
    final isAdmin = ref.watch(isAdminProvider);
    final families = familiesAsync.valueOrNull ?? const [];

    return Scaffold(
      backgroundColor: AppColors.background,
      // Hidden while the list could not load, as well as for a non-admin. The
      // form needs the Linhas that came from the same failed request, so
      // offering "Novo produto" there opens a form that cannot be completed and
      // cannot say why.
      floatingActionButton: isAdmin && !familiesAsync.hasError
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Novo produto'),
              onPressed: () => _openNewProductForm(families),
            )
          : null,
      // No metrics shortcut in the app bar: Métricas is a peer destination on
      // the Administração hub, one tap away, and a second door to it here
      // would need its own state to stay honest about which Linha is selected.
      appBar: const AtlasAppBar(page: 'Produtos'),
      body: SafeArea(
        child: Column(
          children: [
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
                  onRetry: () => ref.invalidate(adminCatalogFamiliesProvider),
                ),
                data: (families) {
                  final entries = _filtered(families);
                  if (entries.isEmpty) {
                    if (_query.trim().isNotEmpty) {
                      return CatalogEmptyState.noResults(
                        query: _query.trim(),
                        onClear: () => setState(() {
                          _query = '';
                          _searchController.clear();
                        }),
                      );
                    }
                    return CatalogEmptyState(
                      icon: _filter.activeCount > 0
                          ? Icons.filter_alt_off_rounded
                          : Icons.medical_services_outlined,
                      title: _filter.activeCount > 0
                          ? 'Nenhum produto com estes filtros'
                          : 'Nenhum produto ainda',
                      subtitle: _filter.activeCount > 0
                          ? 'Limpe os filtros para ver o catálogo inteiro.'
                          : 'Toque em “Novo produto” para cadastrar o '
                                'primeiro.',
                      action: _filter.activeCount > 0
                          ? TextButton(
                              onPressed: () => setState(
                                () => _filter = const ProductFilterSelection(),
                              ),
                              child: const Text('Limpar filtros'),
                            )
                          : null,
                    );
                  }
                  return RefreshIndicator(
                    color: AppColors.navyDeep,
                    onRefresh: () async =>
                        ref.invalidate(adminCatalogFamiliesProvider),
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: entries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final (variant, family) = entries[index];
                        return CatalogListRow(
                          leading: ProductThumbnail(
                            pictureUrl: variant.pictureUrl,
                            blurhash: variant.pictureBlurhash,
                          ),
                          title: variant.comparisonLabel,
                          subtitle: family.manufacturer,
                          isActive: variant.isActive,
                          trailing: Text(
                            brl(variant.price),
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.navyDeep,
                            ),
                          ),
                          onTap: () => _openEditor(variant, families),
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

import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/potential_definitions_repository.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `Administração › Métricas` (spec 0016 §4.4) — CRUD of the potential metric
/// definitions of one Linha, and which of our products count toward each.
///
/// Was `PotentialDefinitionsAdminScreen` at `/catalog/potential-definitions`,
/// reachable only from `/catalog`, which nothing linked to (spec 0016 §1.1).
class AdminMetricsScreen extends ConsumerStatefulWidget {
  const AdminMetricsScreen({super.key});

  @override
  ConsumerState<AdminMetricsScreen> createState() => _AdminMetricsScreenState();
}

class _AdminMetricsScreenState extends ConsumerState<AdminMetricsScreen> {
  final _repo = PotentialDefinitionsRepository();
  final _catalog = CatalogRepository();

  int? _verticalId;
  List<PotentialDefinition> _defs = const [];
  bool _loading = true;
  String? _error;

  Future<void> _selectVertical(int id) async {
    setState(() => _verticalId = id);
    await _load();
  }

  Future<void> _load() async {
    final verticalId = _verticalId;
    if (verticalId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final defs = await _repo.list(verticalId);
      if (!mounted) return;
      setState(() {
        _defs = defs;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Falha ao carregar definições';
        _loading = false;
      });
    }
  }

  Future<void> _createDefinition() async {
    final verticalId = _verticalId;
    if (verticalId == null) return;
    final label = await _askForLabel(
      title: 'Novo campo de potencial',
      confirmLabel: 'Criar',
      hintText: 'Ex.: Ampolas/mês',
    );
    if (label == null || label.isEmpty) return;
    try {
      await _repo.create(verticalId: verticalId, label: label);
      await _load();
    } catch (_) {
      if (!mounted) return;
      showCatalogSnack(context, 'Não foi possível criar', isError: true);
    }
  }

  /// The dialog owns its own `TextEditingController`, in [_LabelDialog].
  ///
  /// It used to be created here and disposed on the line after `showDialog`
  /// returned, which crashed the app on every save: `showDialog`'s future
  /// completes when the route is *popped*, not when its widgets are gone, so
  /// the still-mounted `TextField` was left holding a disposed controller —
  /// `'_dependents.isEmpty': is not true`, a red screen instead of a metric.
  Future<String?> _askForLabel({
    required String title,
    required String confirmLabel,
    String? initialValue,
    String? hintText,
  }) {
    return showDialog<String>(
      context: context,
      builder: (_) => _LabelDialog(
        title: title,
        confirmLabel: confirmLabel,
        initialValue: initialValue,
        hintText: hintText,
      ),
    );
  }

  /// Returns the new label, or null when nothing changed — the metric screen
  /// uses it to update its own title without popping.
  Future<String?> _editDefinition(PotentialDefinition def) async {
    final label = await _askForLabel(
      title: 'Renomear métrica',
      confirmLabel: 'Salvar',
      initialValue: def.label,
    );
    if (label == null || label.isEmpty || label == def.label) return null;
    try {
      await _repo.update(id: def.id, label: label);
      await _load();
      if (mounted) showCatalogSnack(context, 'Métrica renomeada');
      return label;
    } catch (_) {
      if (!mounted) return null;
      showCatalogSnack(context, 'Não foi possível salvar', isError: true);
      return null;
    }
  }

  /// Returns true when the metric is gone, so the screen showing it can pop.
  Future<bool> _deleteDefinition(PotentialDefinition def) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover métrica?'),
        content: Text(
          '“${def.label}” deixa de aparecer nas listas e no cadastro das '
          'clínicas. Os valores já preenchidos e os produtos vinculados '
          'continuam guardados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (ok != true) return false;
    try {
      await _repo.softDelete(def.id);
      await _load();
      if (mounted) showCatalogSnack(context, '“${def.label}” removida');
      return true;
    } catch (_) {
      if (mounted) {
        showCatalogSnack(context, 'Não foi possível remover', isError: true);
      }
      return false;
    }
  }

  Future<void> _manageProducts(PotentialDefinition def) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _DefinitionProductsScreen(
          definition: def,
          repo: _repo,
          catalog: _catalog,
          onRename: () => _editDefinition(def),
          onDelete: () => _deleteDefinition(def),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final optionsAsync = ref.watch(currentUserFacilityVerticalOptionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Métricas'),
      floatingActionButton: _verticalId == null
          ? null
          : FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nova métrica'),
              onPressed: _createDefinition,
            ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // No page heading here: `AtlasAppBar` already says "Métricas", and
            // a second 22px title under it was the only screen in the panel
            // announcing itself twice.
            optionsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: SizedBox(height: 48),
              ),
              error: (_, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: CatalogErrorState(
                  message: 'Não foi possível carregar as linhas',
                  onRetry: () => ref.invalidate(
                    currentUserFacilityVerticalOptionsProvider,
                  ),
                ),
              ),
              data: (options) {
                if (options.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: CatalogInlineEmpty(
                      icon: Icons.info_outline_rounded,
                      message:
                          'Nenhuma linha comercial disponível para o seu '
                          'acesso. Métricas pertencem a uma linha, então não '
                          'há o que listar.',
                    ),
                  );
                }
                final selected =
                    _verticalId != null &&
                        options.any((v) => v.id == _verticalId)
                    ? _verticalId
                    : options.first.id;
                if (_verticalId != selected) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) _selectVertical(selected!);
                  });
                }
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const CatalogFieldLabel('Linha comercial'),
                      const SizedBox(height: 6),
                      CatalogDropdown<int>(
                        value: selected!,
                        items: [for (final v in options) v.id],
                        labelOf: (id) =>
                            options.firstWhere((v) => v.id == id).name,
                        onChanged: _selectVertical,
                      ),
                    ],
                  ),
                );
              },
            ),
            if (_verticalId == null || (_loading && _defs.isEmpty))
              const Expanded(child: SimpleListSkeleton(hasSubtitle: false))
            else if (_error != null)
              Expanded(
                child: CatalogErrorState(message: _error!, onRetry: _load),
              )
            else if (_defs.isEmpty)
              const Expanded(
                child: CatalogEmptyState(
                  icon: Icons.insights_outlined,
                  title: 'Nenhuma métrica nesta linha',
                  subtitle:
                      'Uma métrica é o que o representante preenche por '
                      'clínica — "ampolas/mês", por exemplo. Toque em "Nova '
                      'métrica" para criar a primeira.',
                ),
              )
            else
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.navyDeep,
                  onRefresh: _load,
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                    itemCount: _defs.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final def = _defs[index];
                      return CatalogListRow(
                        leading: const CatalogRowIcon(
                          icon: Icons.insights_outlined,
                          tinted: true,
                        ),
                        title: def.label,
                        subtitle: def.key,
                        // One thing per row, like every other list here.
                        // Renaming and removing live inside the metric, next to
                        // the products they affect — a popup menu on the row
                        // offered three actions and explained none of them.
                        onTap: () => _manageProducts(def),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DefinitionProductsScreen extends StatefulWidget {
  const _DefinitionProductsScreen({
    required this.definition,
    required this.repo,
    required this.catalog,
    required this.onRename,
    required this.onDelete,
  });

  final PotentialDefinition definition;
  final PotentialDefinitionsRepository repo;
  final CatalogRepository catalog;

  /// Renaming and removing the metric live here rather than behind a popup menu
  /// on the list row: this is the screen that shows what the metric *is*, so it
  /// is the screen where changing it makes sense. Both return true when the
  /// list behind needs reloading, and removing also pops this screen.
  final Future<String?> Function() onRename;
  final Future<bool> Function() onDelete;

  @override
  State<_DefinitionProductsScreen> createState() =>
      _DefinitionProductsScreenState();
}

class _DefinitionProductsScreenState extends State<_DefinitionProductsScreen> {
  List<LinkedPotentialProduct> _linked = const [];

  /// The other brands that count toward this metric.
  ///
  /// Read-only by design (spec 0013 §4.6, restated in 0016 §4.4): nothing links
  /// a competitor product to a metric, and nothing should — it would be a second
  /// list able to disagree with this one. A brand appears here when it is the
  /// equivalent of one of our products above, so it is edited from the
  /// equivalences of that product, never from here.
  List<LinkedPotentialProduct> _derivedBrands = const [];
  bool _loading = true;

  /// Kept locally so a rename shows in the title without popping the screen.
  late String _label = widget.definition.label;

  Future<void> _rename() async {
    final renamed = await widget.onRename();
    if (renamed == null || !mounted) return;
    setState(() => _label = renamed);
  }

  Future<void> _remove() async {
    final removed = await widget.onDelete();
    if (removed && mounted) Navigator.of(context).pop();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final linked = await widget.repo.listProducts(widget.definition.id);
      final brands = await widget.repo.listCompetitorProducts(
        widget.definition.id,
      );
      if (!mounted) return;
      setState(() {
        _linked = linked;
        _derivedBrands = brands;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _linkProduct() async {
    try {
      final families = await widget.catalog.getFamilies();
      // Already-linked products are excluded, not merely shown. Offering one
      // means offering an action the API rejects — `product_potential_links` is
      // unique per (product, vertical) — and the admin cannot tell from the
      // picker which of these they already added.
      final linkedIds = {for (final p in _linked) p.productId};
      final products = [
        for (final f in families)
          for (final v in f.variants)
            if (v.verticalIds.contains(widget.definition.verticalId) &&
                !linkedIds.contains(v.id))
              v,
      ];
      if (!mounted) return;
      final picked = await showModalBottomSheet<int>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => _LinkProductSheet(products: products),
      );
      if (picked == null) return;
      await widget.repo.linkProduct(
        productId: picked,
        definitionId: widget.definition.id,
      );
      await _load();
      if (!mounted) return;
      showNightlyRecomputeNotice(context);
    } catch (_) {
      if (!mounted) return;
      showCatalogSnack(
        context,
        'Não foi possível vincular: o produto precisa ser da mesma linha.',
        isError: true,
      );
    }
  }

  /// Unlinking is not a cosmetic change, so it asks first and says what it does.
  ///
  /// Spec 0013 §4.6: the read joins `product_potential_links`, so unlinking
  /// stops *every* quantity a rep recorded for this product counting, at every
  /// clinic. The rows are kept, not deleted — relinking brings them back — and
  /// the confirmation must not claim otherwise.
  Future<void> _unlink(LinkedPotentialProduct p) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Desvincular produto?'),
        content: Text(
          '“${p.name}” deixa de contar para “${widget.definition.label}” em '
          'todas as clínicas. As quantidades já registradas não são apagadas — '
          'voltam a contar se o produto for vinculado de novo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Desvincular'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.repo.unlinkProduct(
        productId: p.productId,
        definitionId: widget.definition.id,
      );
      await _load();
      if (!mounted) return;
      showNightlyRecomputeNotice(context);
    } catch (_) {
      if (!mounted) return;
      showCatalogSnack(context, 'Não foi possível desvincular', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_label),
        actions: [
          IconButton(
            onPressed: _rename,
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Renomear métrica',
          ),
          IconButton(
            onPressed: _remove,
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: AppColors.error,
            ),
            tooltip: 'Remover métrica',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.navyDeep,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_link_rounded),
        label: const Text('Vincular produto'),
        onPressed: _linkProduct,
      ),
      body: _loading
          ? const SimpleListSkeleton()
          : RefreshIndicator(
              color: AppColors.navyDeep,
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.only(bottom: 100),
                children: [
                  const _MetricSectionHeader('Nossos produtos'),
                  if (_linked.isEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: CatalogInlineEmpty(
                        icon: Icons.link_off_rounded,
                        message:
                            'Nenhum produto vinculado. Sem isso, nada que o '
                            'representante registrar conta para esta métrica.',
                      ),
                    )
                  else
                    for (final p in _linked)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: CatalogListRow(
                          leading: const CatalogRowIcon(
                            icon: Icons.medical_services_outlined,
                            tinted: true,
                          ),
                          title: p.name,
                          subtitle: p.code,
                          trailing: IconButton(
                            icon: const Icon(
                              Icons.link_off_rounded,
                              size: 18,
                              color: AppColors.error,
                            ),
                            tooltip: 'Desvincular',
                            onPressed: () => _unlink(p),
                          ),
                          // No row tap: unlinking is the only thing to do here
                          // and making the whole row do it turns a mis-tap into
                          // a destructive action.
                        ),
                      ),
                  const _MetricSectionHeader('Outras marcas que contam'),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(
                      'Esta lista é derivada, não editável: uma marca conta '
                      'para a métrica quando é equivalente a um dos nossos '
                      'produtos acima. Para incluir ou remover uma marca, '
                      'edite as equivalências do produto correspondente.',
                      style: TextStyle(fontSize: 12, color: AppColors.gray400),
                    ),
                  ),
                  if (_derivedBrands.isEmpty)
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: CatalogInlineEmpty(
                        message:
                            'Nenhum produto concorrente é equivalente aos '
                            'produtos acima.',
                      ),
                    )
                  else
                    for (final brand in _derivedBrands)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: _DerivedBrandRow(
                          name: brand.name,
                          code: brand.code,
                        ),
                      ),
                ],
              ),
            ),
    );
  }
}

class _MetricSectionHeader extends StatelessWidget {
  const _MetricSectionHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
    child: Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: AppColors.navyDeep,
      ),
    ),
  );
}

/// The label prompt behind "Novo campo de potencial" and "Editar label".
///
/// A `StatefulWidget` purely so the controller's lifetime is the dialog's own —
/// see `_askForLabel` for what the alternative cost.
class _LabelDialog extends StatefulWidget {
  const _LabelDialog({
    required this.title,
    required this.confirmLabel,
    this.initialValue,
    this.hintText,
  });

  final String title;
  final String confirmLabel;
  final String? initialValue;
  final String? hintText;

  @override
  State<_LabelDialog> createState() => _LabelDialogState();
}

class _LabelDialogState extends State<_LabelDialog> {
  late final _controller = TextEditingController(text: widget.initialValue);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: InputDecoration(
          labelText: 'Label',
          hintText: widget.hintText,
        ),
        onSubmitted: (value) => Navigator.pop(context, value.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}

/// A competitor product that counts toward this metric.
///
/// Flat, not tappable and not a [CatalogListRow]: the list is derived (spec
/// 0013 §4.6) and there is nothing to open. A row that looks like the tappable
/// ones above it and does nothing is worse than one that looks inert.
class _DerivedBrandRow extends StatelessWidget {
  const _DerivedBrandRow({required this.name, required this.code});

  final String name;
  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceTertiary,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.storefront_outlined,
            size: 18,
            color: AppColors.gray400,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray700,
                  ),
                ),
                if (code.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    code,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.gray400,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The "vincular produto" picker.
///
/// Searchable, because the list is every product in the metric's linha and the
/// admin arrives knowing which one they want. It used to be an unsearchable
/// `ListView` of `ListTile`s in a square-cornered sheet — the only sheet in the
/// panel without a grabber, a 17px title or a way out other than the system
/// back gesture.
class _LinkProductSheet extends StatefulWidget {
  const _LinkProductSheet({required this.products});

  final List<CatalogVariant> products;

  @override
  State<_LinkProductSheet> createState() => _LinkProductSheetState();
}

class _LinkProductSheetState extends State<_LinkProductSheet> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final products = query.isEmpty
        ? widget.products
        : widget.products
              .where(
                (p) =>
                    p.name.toLowerCase().contains(query) ||
                    p.code.toLowerCase().contains(query),
              )
              .toList();

    return SafeArea(
      top: false,
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.75,
        decoration: const BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 6),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.gray200,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 8, 8),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Vincular produto',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Fechar',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.close_rounded,
                      size: 20,
                      color: AppColors.gray500,
                    ),
                  ),
                ],
              ),
            ),
            CatalogSearchBar(
              controller: _controller,
              hintText: 'Buscar produto…',
              onChanged: (value) => setState(() => _query = value),
            ),
            Expanded(
              child: products.isEmpty
                  ? (_query.trim().isNotEmpty
                        ? CatalogEmptyState.noResults(
                            query: _query.trim(),
                            onClear: () => setState(() {
                              _query = '';
                              _controller.clear();
                            }),
                          )
                        : const CatalogEmptyState(
                            icon: Icons.check_circle_outline_rounded,
                            title: 'Nada a vincular',
                            subtitle:
                                'Todos os produtos desta linha já contam para '
                                'esta métrica.',
                          ))
                  : ListView.separated(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemCount: products.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final product = products[index];
                        return CatalogListRow(
                          leading: const CatalogRowIcon(
                            icon: Icons.medical_services_outlined,
                            tinted: true,
                          ),
                          title: product.name,
                          subtitle: product.code,
                          onTap: () => Navigator.pop(context, product.id),
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

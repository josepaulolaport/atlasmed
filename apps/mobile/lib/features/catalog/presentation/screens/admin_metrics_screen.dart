import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/potential_definitions_repository.dart';
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
  ConsumerState<AdminMetricsScreen> createState() =>
      _AdminMetricsScreenState();
}

class _AdminMetricsScreenState
    extends ConsumerState<AdminMetricsScreen> {
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Não foi possível criar')));
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

  Future<void> _editDefinition(PotentialDefinition def) async {
    final label = await _askForLabel(
      title: 'Editar label',
      confirmLabel: 'Salvar',
      initialValue: def.label,
    );
    if (label == null || label.isEmpty || label == def.label) return;
    try {
      await _repo.update(id: def.id, label: label);
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Não foi possível salvar')));
    }
  }

  Future<void> _deleteDefinition(PotentialDefinition def) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover campo?'),
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
    if (ok != true) return;
    try {
      await _repo.softDelete(def.id);
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Não foi possível remover')));
    }
  }

  Future<void> _manageProducts(PotentialDefinition def) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _DefinitionProductsScreen(
          definition: def,
          repo: _repo,
          catalog: _catalog,
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
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                'Métricas de potencial por linha',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navyDeep,
                ),
              ),
            ),
            optionsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Erro ao carregar linhas'),
              ),
              data: (options) {
                if (options.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Nenhuma linha comercial disponível'),
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
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: DropdownButtonFormField<int>(
                    initialValue: selected,
                    decoration: const InputDecoration(
                      labelText: 'Linha comercial',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final v in options)
                        DropdownMenuItem(value: v.id, child: Text(v.name)),
                    ],
                    onChanged: (id) {
                      if (id == null) return;
                      _selectVertical(id);
                    },
                  ),
                );
              },
            ),
            if (_verticalId == null || (_loading && _defs.isEmpty))
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    itemCount: _defs.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final def = _defs[index];
                      return Card(
                        child: ListTile(
                          title: Text(def.label),
                          subtitle: Text(def.key),
                          trailing: PopupMenuButton<String>(
                            onSelected: (action) {
                              switch (action) {
                                case 'edit':
                                  _editDefinition(def);
                                case 'products':
                                  _manageProducts(def);
                                case 'delete':
                                  _deleteDefinition(def);
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(
                                value: 'edit',
                                child: Text('Editar label'),
                              ),
                              PopupMenuItem(
                                value: 'products',
                                child: Text('Produtos vinculados'),
                              ),
                              PopupMenuItem(
                                value: 'delete',
                                child: Text('Remover'),
                              ),
                            ],
                          ),
                          onTap: () => _manageProducts(def),
                        ),
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
  });

  final PotentialDefinition definition;
  final PotentialDefinitionsRepository repo;
  final CatalogRepository catalog;

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
      final products = [
        for (final f in families)
          for (final v in f.variants)
            if (v.verticalIds.contains(widget.definition.verticalId)) v,
      ];
      if (!mounted) return;
      final picked = await showModalBottomSheet<int>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(ctx).height * 0.7,
            child: Column(
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Vincular produto',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: products.length,
                    itemBuilder: (context, index) {
                      final p = products[index];
                      return ListTile(
                        title: Text(p.name),
                        subtitle: Text(p.code),
                        onTap: () => Navigator.pop(ctx, p.id),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      if (picked == null) return;
      await widget.repo.linkProduct(
        productId: picked,
        definitionId: widget.definition.id,
      );
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Os números das clínicas são atualizados no próximo processamento '
            'noturno.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Falha ao vincular. Produto precisa ser da mesma linha.',
          ),
        ),
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
      // Spec 0013 §4.6 backlogs the catalogue fan-out: recompute is per-profile
      // and nothing recomputes every clinic holding this product. Saying so is
      // the difference between "it worked" and an admin repeating the edit.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Os números das clínicas são atualizados no próximo processamento '
            'noturno.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Falha ao desvincular')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.definition.label),
        actions: [
          IconButton(
            onPressed: _linkProduct,
            icon: const Icon(Icons.add_link_rounded),
            tooltip: 'Vincular produto',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.only(bottom: 32),
                children: [
                  const _MetricSectionHeader('Nossos produtos'),
                  if (_linked.isEmpty)
                    const _MetricEmptyRow('Nenhum produto vinculado')
                  else
                    for (final p in _linked)
                      ListTile(
                        title: Text(p.name),
                        subtitle: Text(p.code),
                        trailing: IconButton(
                          icon: const Icon(Icons.link_off_rounded),
                          tooltip: 'Desvincular',
                          onPressed: () => _unlink(p),
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
                    const _MetricEmptyRow(
                      'Nenhum produto concorrente equivalente aos produtos acima',
                    )
                  else
                    for (final brand in _derivedBrands)
                      ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.storefront_outlined,
                          size: 20,
                          color: AppColors.gray400,
                        ),
                        title: Text(brand.name),
                        subtitle: brand.code.isEmpty ? null : Text(brand.code),
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

class _MetricEmptyRow extends StatelessWidget {
  const _MetricEmptyRow(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
    child: Text(
      message,
      style: const TextStyle(fontSize: 12.5, color: AppColors.gray400),
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

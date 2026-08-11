import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/potential_definitions_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Admin: CRUD potential metric definitions per Linha + link products.
class PotentialDefinitionsAdminScreen extends ConsumerStatefulWidget {
  const PotentialDefinitionsAdminScreen({super.key});

  @override
  ConsumerState<PotentialDefinitionsAdminScreen> createState() =>
      _PotentialDefinitionsAdminScreenState();
}

class _PotentialDefinitionsAdminScreenState
    extends ConsumerState<PotentialDefinitionsAdminScreen> {
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
    final controller = TextEditingController();
    final label = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Novo campo de potencial'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Label',
            hintText: 'Ex.: Ampolas/mês',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Criar'),
          ),
        ],
      ),
    );
    controller.dispose();
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

  Future<void> _editDefinition(PotentialDefinition def) async {
    final controller = TextEditingController(text: def.label);
    final label = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Editar label'),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    controller.dispose();
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
          'Soft-delete de “${def.label}”. Valores e links ficam, campo some das listas.',
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
      appBar: const AtlasAppBar(page: 'Potencial'),
      floatingActionButton: _verticalId == null
          ? null
          : FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Novo campo'),
              onPressed: _createDefinition,
            ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                'Campos de potencial por linha',
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
      if (!mounted) return;
      setState(() {
        _linked = linked;
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

  Future<void> _unlink(LinkedPotentialProduct p) async {
    try {
      await widget.repo.unlinkProduct(
        productId: p.productId,
        definitionId: widget.definition.id,
      );
      await _load();
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
          : _linked.isEmpty
          ? const Center(child: Text('Nenhum produto vinculado'))
          : ListView.separated(
              itemCount: _linked.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final p = _linked[index];
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text(p.code),
                  trailing: IconButton(
                    icon: const Icon(Icons.link_off_rounded),
                    onPressed: () => _unlink(p),
                  ),
                );
              },
            ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/support_catalog.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';

/// `Administração › Catálogos` (spec 0016 §4.6).
///
/// Four small reference lists behind one screen and a segmented control, rather
/// than four drawer-level destinations: each is edited rarely, and four
/// near-identical screens in the hub would bury the catalogue work above them.
///
/// Until this shipped, `docs/architecture/current.md` recorded these as having
/// "no write path in code" — a `psql` session every time a clinic needed a focus
/// or a person a role nobody had thought of yet.
///
/// Deactivate-only (§6.2): each is referenced by operational rows, so retirement
/// is a flag and there is no trash can.
class AdminSupportCatalogsScreen extends ConsumerStatefulWidget {
  const AdminSupportCatalogsScreen({super.key});

  @override
  ConsumerState<AdminSupportCatalogsScreen> createState() =>
      _AdminSupportCatalogsScreenState();
}

class _AdminSupportCatalogsScreenState
    extends ConsumerState<AdminSupportCatalogsScreen> {
  SupportCatalog _catalog = SupportCatalog.healthcareSpecialties;
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _selectCatalog(SupportCatalog catalog) {
    // The query belongs to the list being searched. Carrying "cardio" across to
    // Conselhos shows an empty screen the admin did not ask for.
    setState(() {
      _catalog = catalog;
      _query = '';
      _searchController.clear();
    });
  }

  List<SupportCatalogEntry> _filtered(List<SupportCatalogEntry> all) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return all;
    return all
        .where(
          (entry) =>
              entry.name.toLowerCase().contains(query) ||
              (entry.extra ?? '').toLowerCase().contains(query),
        )
        .toList();
  }

  Future<void> _openForm({SupportCatalogEntry? existing}) async {
    final saved = await showModalBottomSheet<SupportCatalogEntry>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      // Drag-to-dismiss and a tap on the barrier both bypass `PopScope`: the
      // sheet route pops without consulting it, so a half-typed form vanished
      // silently even with the guard in place. The ✕ inside the sheet is
      // guarded, so it becomes the only way out.
      enableDrag: false,
      isDismissible: false,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: _SupportCatalogForm(catalog: _catalog, existing: existing),
      ),
    );
    if (saved == null || !mounted) return;
    ref.invalidate(supportCatalogProvider(_catalog));
    showCatalogSnack(
      context,
      existing == null
          ? '${saved.name} cadastrado'
          : '${saved.name} atualizado',
    );
  }

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(supportCatalogProvider(_catalog));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Catálogos'),
      // Nothing to add to a list that could not load — see the products screen.
      floatingActionButton: entriesAsync.hasError
          ? null
          : FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(_catalog.newLabel),
              onPressed: _openForm,
            ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              // Four segments do not fit a phone width side by side, so they
              // scroll horizontally rather than truncating to initials.
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<SupportCatalog>(
                  segments: [
                    for (final catalog in SupportCatalog.values)
                      ButtonSegment(
                        value: catalog,
                        label: Text(
                          catalog.title,
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      ),
                  ],
                  selected: {_catalog},
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    backgroundColor: Colors.white,
                    selectedBackgroundColor: AppColors.blue50,
                    selectedForegroundColor: AppColors.navyDeep,
                    foregroundColor: AppColors.gray500,
                    side: const BorderSide(color: AppColors.gray200),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onSelectionChanged: (selection) =>
                      _selectCatalog(selection.first),
                ),
              ),
            ),
            // Especialidades alone is 69 rows. Every other list in the panel
            // can be searched; this one could only be scrolled.
            CatalogSearchBar(
              controller: _searchController,
              hintText: 'Buscar ${_catalog.singular}…',
              onChanged: (value) => setState(() => _query = value),
            ),
            Expanded(
              child: entriesAsync.when(
                loading: () => const SimpleListSkeleton(),
                error: (_, _) => CatalogErrorState(
                  onRetry: () =>
                      ref.invalidate(supportCatalogProvider(_catalog)),
                ),
                data: (all) {
                  final entries = _filtered(all);
                  if (entries.isEmpty) {
                    return _query.trim().isNotEmpty
                        ? CatalogEmptyState.noResults(
                            query: _query.trim(),
                            onClear: () => setState(() {
                              _query = '';
                              _searchController.clear();
                            }),
                          )
                        : CatalogEmptyState(
                            icon: Icons.list_alt_rounded,
                            title: 'Nenhum registro ainda',
                            subtitle:
                                'Toque em “${_catalog.newLabel}” para '
                                'cadastrar o primeiro.',
                          );
                  }
                  return RefreshIndicator(
                    color: AppColors.navyDeep,
                    onRefresh: () async =>
                        ref.invalidate(supportCatalogProvider(_catalog)),
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: entries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final entry = entries[index];
                        return CatalogListRow(
                          title: entry.name,
                          subtitle: entry.extra == null
                              ? null
                              : '${_catalog.extraLabel}: ${entry.extra}',
                          isActive: entry.isActive,
                          onTap: () => _openForm(existing: entry),
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

class _SupportCatalogForm extends ConsumerStatefulWidget {
  const _SupportCatalogForm({required this.catalog, this.existing});

  final SupportCatalog catalog;
  final SupportCatalogEntry? existing;

  @override
  ConsumerState<_SupportCatalogForm> createState() =>
      _SupportCatalogFormState();
}

class _SupportCatalogFormState extends ConsumerState<_SupportCatalogForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _extra = TextEditingController(text: widget.existing?.extra);
  late bool _isActive = widget.existing?.isActive ?? true;

  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.existing != null;

  late final String _openedWith = _snapshot();

  String _snapshot() => '${_name.text}\u0000${_extra.text}\u0000$_isActive';

  bool get _hasChanges => _snapshot() != _openedWith;

  bool get _isValid {
    if (_name.text.trim().isEmpty) return false;
    // The councils' `abbreviation` is NOT NULL on the column, so an empty one
    // would be a 500 rather than a validation message.
    if (widget.catalog.extraRequired && _extra.text.trim().isEmpty) {
      return false;
    }
    return true;
  }

  @override
  void initState() {
    super.initState();
    _name.addListener(_onChanged);
    _extra.addListener(_onChanged);
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _name
      ..removeListener(_onChanged)
      ..dispose();
    _extra
      ..removeListener(_onChanged)
      ..dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repository = ref.read(catalogRepositoryProvider);
      final saved = _isEditing
          ? await repository.updateSupportCatalogEntry(
              widget.catalog,
              id: widget.existing!.id,
              name: _name.text.trim(),
              extra: _extra.text.trim(),
              isActive: _isActive,
            )
          : await repository.createSupportCatalogEntry(
              widget.catalog,
              name: _name.text.trim(),
              extra: _extra.text.trim(),
              isActive: _isActive,
            );
      if (!mounted) return;
      Navigator.of(context).pop(saved);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is CatalogApiException
            ? error.message
            : 'Não foi possível salvar. Tente novamente.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final extraLabel = widget.catalog.extraLabel;

    return CatalogFormSheet(
      title: _isEditing
          ? 'Editar ${widget.catalog.singular}'
          : widget.catalog.newLabel,
      saving: _saving,
      error: _error,
      hasChanges: _hasChanges,
      onSave: _isValid ? _submit : null,
      children: [
        CatalogField(
          label: 'Nome',
          controller: _name,
          autofocus: !_isEditing,
          capitalization: TextCapitalization.sentences,
          hint: 'Ex.: Cardiologia',
        ),
        if (extraLabel != null) ...[
          const SizedBox(height: 16),
          CatalogField(
            label: widget.catalog.extraRequired
                ? extraLabel
                : '$extraLabel (opcional)',
            controller: _extra,
            capitalization: TextCapitalization.characters,
          ),
        ],
        const SizedBox(height: 4),
        CatalogActiveSwitch(
          value: _isActive,
          onChanged: (value) => setState(() => _isActive = value),
          explanation:
              'Um registro inativo some dos seletores. O que já foi '
              'preenchido com ele continua valendo.',
        ),
      ],
    );
  }
}

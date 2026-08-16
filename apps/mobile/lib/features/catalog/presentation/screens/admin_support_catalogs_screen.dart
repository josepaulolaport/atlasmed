import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/support_catalog.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

/// `Administração › Catálogos` (spec 0016 §4.6).
///
/// Three small reference lists behind one screen and a segmented control, rather
/// than three drawer-level destinations: each is a handful of rows, edited
/// rarely, and three near-identical screens in the hub would bury the catalogue
/// work above them.
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

  Future<void> _openForm({SupportCatalogEntry? existing}) async {
    final saved = await showModalBottomSheet<SupportCatalogEntry>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: _SupportCatalogForm(catalog: _catalog, existing: existing),
      ),
    );
    if (saved == null || !mounted) return;
    ref.invalidate(supportCatalogProvider(_catalog));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          existing == null
              ? '${saved.name} cadastrado'
              : '${saved.name} atualizado',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(supportCatalogProvider(_catalog));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Catálogos'),
      floatingActionButton: FloatingActionButton.extended(
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
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
                  onSelectionChanged: (selection) =>
                      setState(() => _catalog = selection.first),
                ),
              ),
            ),
            Expanded(
              child: entriesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Não foi possível carregar.'),
                      TextButton(
                        onPressed: () =>
                            ref.invalidate(supportCatalogProvider(_catalog)),
                        child: const Text('Tentar de novo'),
                      ),
                    ],
                  ),
                ),
                data: (entries) => entries.isEmpty
                    ? const Center(
                        child: Text(
                          'Nenhum registro',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.gray400,
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async =>
                            ref.invalidate(supportCatalogProvider(_catalog)),
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                          itemCount: entries.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final entry = entries[index];
                            return ListTile(
                              title: Text(
                                entry.name,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: entry.isActive
                                      ? AppColors.gray900
                                      : AppColors.gray400,
                                ),
                              ),
                              subtitle: entry.extra == null
                                  ? null
                                  : Text(
                                      '${_catalog.extraLabel}: ${entry.extra}',
                                    ),
                              trailing: entry.isActive
                                  ? const Icon(
                                      Icons.chevron_right_rounded,
                                      size: 18,
                                      color: AppColors.gray400,
                                    )
                                  : const Text(
                                      'Inativo',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.gray700,
                                      ),
                                    ),
                              onTap: () => _openForm(existing: entry),
                            );
                          },
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

  bool get _isValid {
    if (_name.text.trim().isEmpty) return false;
    // The councils' `abbreviation` is NOT NULL on the column, so an empty one
    // would be a 500 rather than a validation message.
    if (widget.catalog.extraRequired && _extra.text.trim().isEmpty) return false;
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

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isEditing
                  ? 'Editar ${widget.catalog.singular}'
                  : widget.catalog.newLabel,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              autofocus: !_isEditing,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Nome',
                border: OutlineInputBorder(),
              ),
            ),
            if (extraLabel != null) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _extra,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: widget.catalog.extraRequired
                      ? extraLabel
                      : '$extraLabel (opcional)',
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              dense: true,
              value: _isActive,
              onChanged: (value) => setState(() => _isActive = value),
              title: const Text(
                'Ativo',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
              ),
              subtitle: const Text(
                'Um registro inativo some dos seletores. O que já foi '
                'preenchido com ele continua valendo.',
                style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(fontSize: 12.5, color: AppColors.error),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _isValid && !_saving ? _submit : null,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.navyDeep,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Salvar',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14.5,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

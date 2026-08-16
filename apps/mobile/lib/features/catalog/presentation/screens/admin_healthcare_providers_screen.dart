import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/healthcare_provider.dart';
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

/// `Administração › Fontes pagadoras` (spec 0016 §4.5).
///
/// Reference data, edited here, consumed on the clinic screen: a rep picks from
/// this list when recording a clinic's payer mix, and until now the only way to
/// add an entry was a `psql` session. Registering a new one from the panel is a
/// stated requirement (§10 Q6).
///
/// Deactivate-only — `facility_healthcare_provider_shares` references these rows
/// (§6.2), and a share that lost its provider would be a percentage of nothing.
class AdminHealthcareProvidersScreen extends ConsumerStatefulWidget {
  const AdminHealthcareProvidersScreen({super.key});

  @override
  ConsumerState<AdminHealthcareProvidersScreen> createState() =>
      _AdminHealthcareProvidersScreenState();
}

class _AdminHealthcareProvidersScreenState
    extends ConsumerState<AdminHealthcareProvidersScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<HealthcareProvider> _filtered(List<HealthcareProvider> all) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return all;
    return all
        .where((provider) => provider.name.toLowerCase().contains(query))
        .toList();
  }

  Future<void> _openForm({HealthcareProvider? existing}) async {
    final saved = await showModalBottomSheet<HealthcareProvider>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: _ProviderForm(existing: existing),
      ),
    );
    if (saved == null || !mounted) return;
    ref.invalidate(adminHealthcareProvidersProvider);
    showCatalogSnack(
      context,
      existing == null
          ? '${saved.name} cadastrada'
          : '${saved.name} atualizada',
    );
  }

  /// A payer type is the one thing that distinguishes these rows from each
  /// other at a glance, so it gets an icon rather than only a subtitle.
  static IconData _iconFor(HealthcareProviderType type) => switch (type) {
    HealthcareProviderType.private => Icons.business_center_outlined,
    HealthcareProviderType.public => Icons.account_balance_outlined,
    HealthcareProviderType.mixed => Icons.swap_horiz_rounded,
    HealthcareProviderType.other => Icons.more_horiz_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(adminHealthcareProvidersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Fontes pagadoras'),
      // Nothing to add to a list that could not load — see the products screen.
      floatingActionButton: providersAsync.hasError
          ? null
          : FloatingActionButton.extended(
              backgroundColor: AppColors.navyDeep,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nova fonte'),
              onPressed: _openForm,
            ),
      body: SafeArea(
        child: Column(
          children: [
            CatalogSearchBar(
              controller: _searchController,
              hintText: 'Buscar fonte pagadora…',
              onChanged: (value) => setState(() => _query = value),
            ),
            Expanded(
              child: providersAsync.when(
                loading: () => const ProductListSkeleton(),
                error: (_, _) => CatalogErrorState(
                  onRetry: () =>
                      ref.invalidate(adminHealthcareProvidersProvider),
                ),
                data: (all) {
                  final providers = _filtered(all);
                  if (providers.isEmpty) {
                    return _query.trim().isNotEmpty
                        ? CatalogEmptyState.noResults(
                            query: _query.trim(),
                            onClear: () => setState(() {
                              _query = '';
                              _searchController.clear();
                            }),
                          )
                        : const CatalogEmptyState(
                            icon: Icons.account_balance_wallet_outlined,
                            title: 'Nenhuma fonte pagadora ainda',
                            subtitle:
                                'Toque em “Nova fonte” para cadastrar a '
                                'primeira. Elas aparecem no seletor de '
                                'participação das clínicas.',
                          );
                  }
                  return RefreshIndicator(
                    color: AppColors.navyDeep,
                    onRefresh: () async =>
                        ref.invalidate(adminHealthcareProvidersProvider),
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                      itemCount: providers.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final provider = providers[index];
                        return CatalogListRow(
                          leading: CatalogRowIcon(
                            icon: _iconFor(provider.type),
                          ),
                          title: provider.name,
                          subtitle: provider.type.label,
                          isActive: provider.isActive,
                          onTap: () => _openForm(existing: provider),
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

/// Three fields, so a sheet rather than a pushed screen — matching how the rest
/// of the panel splits short forms from long ones (spec 0016 §4).
class _ProviderForm extends ConsumerStatefulWidget {
  const _ProviderForm({this.existing});

  final HealthcareProvider? existing;

  @override
  ConsumerState<_ProviderForm> createState() => _ProviderFormState();
}

class _ProviderFormState extends ConsumerState<_ProviderForm> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late HealthcareProviderType _type =
      widget.existing?.type ?? HealthcareProviderType.private;
  late bool _isActive = widget.existing?.isActive ?? true;

  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.existing != null;

  late final String _openedWith = _snapshot();

  String _snapshot() => '${_name.text}\u0000$_type\u0000$_isActive';

  bool get _hasChanges => _snapshot() != _openedWith;

  @override
  void initState() {
    super.initState();
    _name.addListener(_onChanged);
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _name
      ..removeListener(_onChanged)
      ..dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repository = ref.read(catalogRepositoryProvider);
      final saved = _isEditing
          ? await repository.updateHealthcareProvider(
              widget.existing!.copyWith(
                name: name,
                type: _type,
                isActive: _isActive,
              ),
            )
          : await repository.createHealthcareProvider(
              name: name,
              type: _type,
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
    return CatalogFormSheet(
      title: _isEditing ? 'Editar fonte pagadora' : 'Nova fonte pagadora',
      saving: _saving,
      error: _error,
      hasChanges: _hasChanges,
      onSave: _name.text.trim().isEmpty ? null : _submit,
      children: [
        CatalogField(
          label: 'Nome',
          controller: _name,
          autofocus: !_isEditing,
          capitalization: TextCapitalization.words,
          hint: 'Ex.: Unimed',
        ),
        const SizedBox(height: 16),
        const CatalogFieldLabel('Tipo'),
        const SizedBox(height: 6),
        CatalogDropdown<HealthcareProviderType>(
          value: _type,
          items: HealthcareProviderType.values,
          labelOf: (type) => type.label,
          onChanged: (type) => setState(() => _type = type),
        ),
        const SizedBox(height: 4),
        CatalogActiveSwitch(
          value: _isActive,
          onChanged: (value) => setState(() => _isActive = value),
          label: 'Ativa',
          explanation:
              'Uma fonte inativa deixa de aparecer no seletor da clínica. '
              'As participações já registradas continuam valendo.',
        ),
      ],
    );
  }
}

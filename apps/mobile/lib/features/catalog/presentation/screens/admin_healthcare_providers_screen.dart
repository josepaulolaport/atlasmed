import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/healthcare_provider.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          existing == null
              ? '${saved.name} cadastrada'
              : '${saved.name} atualizada',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(adminHealthcareProvidersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Fontes pagadoras'),
      floatingActionButton: FloatingActionButton.extended(
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
              filterCount: 0,
              onFilter: () {},
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
                    return const Center(
                      child: Text(
                        'Nenhuma fonte pagadora encontrada',
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
                    itemCount: providers.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final provider = providers[index];
                      return _ProviderRow(
                        provider: provider,
                        onTap: () => _openForm(existing: provider),
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

class _ProviderRow extends StatelessWidget {
  const _ProviderRow({required this.provider, required this.onTap});

  final HealthcareProvider provider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            provider.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: provider.isActive
                                  ? AppColors.gray900
                                  : AppColors.gray400,
                            ),
                          ),
                        ),
                        if (!provider.isActive) ...[
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
                              'Inativa',
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
                    const SizedBox(height: 2),
                    Text(
                      provider.type.label,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                ),
              ),
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
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isEditing ? 'Editar fonte pagadora' : 'Nova fonte pagadora',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              autofocus: !_isEditing,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Nome',
                hintText: 'Ex.: Unimed',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<HealthcareProviderType>(
              initialValue: _type,
              decoration: const InputDecoration(
                labelText: 'Tipo',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final type in HealthcareProviderType.values)
                  DropdownMenuItem(value: type, child: Text(type.label)),
              ],
              onChanged: (type) {
                if (type == null) return;
                setState(() => _type = type);
              },
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              dense: true,
              value: _isActive,
              onChanged: (value) => setState(() => _isActive = value),
              title: const Text(
                'Ativa',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
              ),
              subtitle: const Text(
                'Uma fonte inativa deixa de aparecer no seletor da clínica. As '
                'participações já registradas continuam valendo.',
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
              onPressed: _name.text.trim().isEmpty || _saving ? null : _submit,
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

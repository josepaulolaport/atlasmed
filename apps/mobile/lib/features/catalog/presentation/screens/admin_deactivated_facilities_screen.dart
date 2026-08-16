import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/deactivated_facility.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/subscreen_app_bar.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';

/// `Administração › Clínicas desativadas` (spec 0016 §4.8).
///
/// Deactivation is a soft delete — `facilities.deactivated_at` is set and the
/// search document removed — and it was one-way in practice. The repository had
/// a `reactivate` method that nothing called, and no read anywhere could return
/// a deactivated clinic: `findById` filters them, the list filters them, and
/// Explorar reads Meilisearch, which no longer holds them. An admin who wanted
/// one back had to know its id and there was nowhere to learn it.
///
/// This is the only screen in the panel that edits operational data rather than
/// reference data. Spec 0016 §2.3 kept facilities out for that reason; the
/// exception is deliberate, because undoing an admin action belongs beside the
/// admin's other actions, and Explorar cannot show a clinic it cannot find.
class AdminDeactivatedFacilitiesScreen extends ConsumerStatefulWidget {
  const AdminDeactivatedFacilitiesScreen({super.key});

  @override
  ConsumerState<AdminDeactivatedFacilitiesScreen> createState() =>
      _AdminDeactivatedFacilitiesScreenState();
}

class _AdminDeactivatedFacilitiesScreenState
    extends ConsumerState<AdminDeactivatedFacilitiesScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  int? _working;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<DeactivatedFacility> _filtered(List<DeactivatedFacility> all) {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return all;
    return all
        .where(
          (facility) =>
              facility.name.toLowerCase().contains(query) ||
              (facility.legalDocument ?? '').contains(query) ||
              (facility.cnesCode ?? '').contains(query) ||
              facility.location.toLowerCase().contains(query),
        )
        .toList();
  }

  Future<void> _reactivate(DeactivatedFacility facility) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reativar clínica?'),
        content: Text(
          '“${facility.name}” volta a aparecer no Explorar, na busca e nos '
          'números do Desempenho. As visitas, os pedidos e o cadastro que ela '
          'já tinha continuam como estavam.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reativar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = facility.id);
    try {
      await ref.read(catalogRepositoryProvider).reactivateFacility(facility.id);
      ref.invalidate(adminDeactivatedFacilitiesProvider);
      if (!mounted) return;
      setState(() => _working = null);
      showCatalogSnack(context, '${facility.name} reativada');
    } catch (error) {
      if (!mounted) return;
      setState(() => _working = null);
      showCatalogSnack(
        context,
        error is CatalogApiException
            ? error.message
            : 'Não foi possível reativar. Tente novamente.',
        isError: true,
      );
    }
  }

  /// Why a row cannot be reactivated, in the admin's terms.
  void _explainBlock(DeactivatedFacility facility) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Esta clínica não pode ser reativada'),
        content: Text(
          'Outra clínica ativa já usa o CNPJ ${facility.legalDocument}. Um CNPJ '
          'só pode pertencer a uma clínica ativa por vez, então é preciso '
          'corrigir o cadastro da outra antes de trazer esta de volta.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Entendi'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final facilitiesAsync = ref.watch(adminDeactivatedFacilitiesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const SubscreenAppBar(title: 'Clínicas desativadas'),
      body: SafeArea(
        child: Column(
          children: [
            CatalogSearchBar(
              controller: _searchController,
              hintText: 'Buscar por nome, CNPJ ou CNES…',
              onChanged: (value) => setState(() => _query = value),
            ),
            Expanded(
              child: facilitiesAsync.when(
                loading: () => const SimpleListSkeleton(),
                error: (_, _) => CatalogErrorState(
                  onRetry: () =>
                      ref.invalidate(adminDeactivatedFacilitiesProvider),
                ),
                data: (all) {
                  final facilities = _filtered(all);
                  if (facilities.isEmpty) {
                    return _query.trim().isNotEmpty
                        ? CatalogEmptyState.noResults(
                            query: _query.trim(),
                            onClear: () => setState(() {
                              _query = '';
                              _searchController.clear();
                            }),
                          )
                        : const CatalogEmptyState(
                            icon: Icons.check_circle_outline_rounded,
                            title: 'Nenhuma clínica desativada',
                            subtitle:
                                'Toda clínica do sistema está ativa. As que '
                                'forem desativadas aparecem aqui para poderem '
                                'voltar.',
                          );
                  }
                  return RefreshIndicator(
                    color: AppColors.navyDeep,
                    onRefresh: () async =>
                        ref.invalidate(adminDeactivatedFacilitiesProvider),
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: facilities.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final facility = facilities[index];
                        return CatalogListRow(
                          leading: const CatalogRowIcon(
                            icon: Icons.local_hospital_outlined,
                          ),
                          title: facility.name,
                          subtitle: facility.location,
                          // Its own line rather than appended to the location:
                          // together they overran one line and the date — the
                          // thing that tells the admin whether this was recent
                          // — was the half that got ellipsised away.
                          note: facility.deactivatedAt == null
                              ? null
                              : 'Desativada em '
                                    '${_formatDate(facility.deactivatedAt!)}',
                          // Every row here is inactive by definition, so the
                          // badge would be on all of them and say nothing.
                          isActive: true,
                          warning: facility.isBlocked
                              ? 'CNPJ em uso por outra clínica'
                              : null,
                          trailing: _working == facility.id
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : TextButton(
                                  onPressed: facility.isBlocked
                                      ? () => _explainBlock(facility)
                                      : () => _reactivate(facility),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                    ),
                                    minimumSize: Size.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    foregroundColor: facility.isBlocked
                                        ? AppColors.gray400
                                        : AppColors.navyDeep,
                                  ),
                                  child: const Text(
                                    'Reativar',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
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

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }
}

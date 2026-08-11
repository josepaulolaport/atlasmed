import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/competitor_quantity_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_potential_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Potencial de mercado — our quantity, each competitor's, the total market
/// and our share of it, per Linha (spec 0013).
class ClinicPotentialSection extends ConsumerWidget {
  const ClinicPotentialSection({
    super.key,
    required this.facilityId,
    required this.canEdit,
  });

  final int facilityId;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalId = ref.watch(clinicDetailActiveLinhaIdProvider(facilityId));
    final async = ref.watch(clinicDetailPotentialsProvider(facilityId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The rep's editing surface is rebuilt in P4-5 as a competitor picker
        // (spec 0013 §6). The old "Editar potencial" sheet wrote
        // facility_potential_values, which no longer exists.
        const ClinicSectionHeader(title: 'Potencial de mercado'),
        if (verticalId == null)
          const ClinicDetailCard(
            child: Text(
              'Selecione uma linha comercial para ver o potencial.',
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppColors.gray500,
              ),
            ),
          )
        else
          async.when(
            loading: () => const ClinicDetailCard(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
            error: (err, _) => ClinicDetailCard(
              child: Column(
                children: [
                  Text(
                    'Não foi possível carregar potencial.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray500,
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(
                      clinicDetailPotentialsProvider(facilityId),
                    ),
                    child: const Text('Tentar de novo'),
                  ),
                ],
              ),
            ),
            data: (page) {
              if (page == null || page.items.isEmpty) {
                return const ClinicaEmptySection(
                  icon: Icons.insights_outlined,
                  title: 'Nenhum campo de potencial configurado',
                  description:
                      'Os campos de potencial desta linha aparecerão aqui quando forem configurados.',
                );
              }
              return ClinicDetailCard(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Column(
                  children: [
                    for (var i = 0; i < page.items.length; i++) ...[
                      if (i > 0)
                        const Divider(height: 20, color: AppColors.gray100),
                      _PotentialRow(
                        item: page.items[i],
                        onEdit: canEdit
                            ? (existing) => _editCompetitor(
                                context,
                                ref,
                                facilityId: facilityId,
                                verticalId: verticalId,
                                item: page.items[i],
                                existing: existing,
                              )
                            : null,
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

/// Opens the quantity sheet and refreshes the section from the response.
///
/// The server returns the recomputed page, so nothing re-fetches and risks
/// showing a different answer than the one the write produced.
Future<void> _editCompetitor(
  BuildContext context,
  WidgetRef ref, {
  required int facilityId,
  required int verticalId,
  required FacilityPotentialItem item,
  CompetitorUsage? existing,
}) async {
  final repository = FacilityPotentialRepository(
    facilityId: facilityId,
    verticalId: verticalId,
  );
  try {
    final updated = await showModalBottomSheet<FacilityPotentialsPage>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => CompetitorQuantitySheet(
        definitionLabel: item.label,
        definitionId: item.definitionId,
        repository: repository,
        existing: existing,
      ),
    );
    if (updated != null) {
      ref.invalidate(
        facilityPotentialsProvider((
          facilityId: facilityId,
          verticalId: verticalId,
        )),
      );
    }
  } finally {
    repository.dispose();
  }
}

class _PotentialRow extends StatelessWidget {
  const _PotentialRow({required this.item, this.onEdit});

  final FacilityPotentialItem item;

  /// Null when the user may not edit this clinic — the affordance disappears
  /// rather than appearing and failing.
  final void Function(CompetitorUsage? existing)? onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          item.label,
          style: const TextStyle(
            fontSize: 15,
            height: 1.25,
            fontWeight: FontWeight.w700,
            color: AppColors.navyDeep,
          ),
        ),
        const SizedBox(height: 10),
        // Two rows of two rather than four across: at 360dp the four-column
        // layout truncated every label to an ellipsis, so the numbers had no
        // readable captions.
        Row(
          children: [
            Expanded(
              child: _Metric(
                label: 'AtlasMed/mês',
                value: _fmtQty(item.atlasmedMonthlyAvgQty),
              ),
            ),
            Expanded(
              child: _Metric(
                label: 'Concorrentes/mês',
                value: _fmtQty(item.competitorMonthlyQty),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _Metric(
                label: 'Mercado total',
                value: _fmtQty(item.totalMarketQty),
              ),
            ),
            Expanded(
              child: _Metric(
                label: 'Participação',
                // Null, not 0 — nothing recorded is not the same as no sales.
                value: item.share == null
                    ? '—'
                    : '${(item.share! * 100).toStringAsFixed(0)}%',
              ),
            ),
          ],
        ),
        _CompetitorTable(competitors: item.competitors, onEdit: onEdit),
      ],
    );
  }
}

/// Who makes up "Concorrentes/mês", and how much of it each one is.
///
/// The server has always sent this list; nothing rendered it, so the competitor
/// figure was a lump sum the rep could not check or correct.
class _CompetitorTable extends StatelessWidget {
  const _CompetitorTable({required this.competitors, this.onEdit});

  final List<CompetitorUsage> competitors;
  final void Function(CompetitorUsage? existing)? onEdit;

  @override
  Widget build(BuildContext context) {
    if (competitors.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nenhum concorrente registrado neste mês.',
              style: TextStyle(
                fontSize: 13,
                height: 1.3,
                color: AppColors.gray500,
              ),
            ),
            if (onEdit != null)
              TextButton(
                onPressed: () => onEdit!(null),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Adicionar concorrente'),
              ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Produto concorrente',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              Text(
                'Qtd/mês',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray500,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
          for (final competitor in competitors) ...[
            const SizedBox(height: 8),
            InkWell(
              onTap: onEdit == null ? null : () => onEdit!(competitor),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      competitor.productName,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.3,
                        color: AppColors.navyDeep,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    // The rep's own number, in the units they typed it in — the
                    // metric-unit conversion belongs to the totals above, not
                    // here, or they cannot recognise what they entered.
                    _fmtQty(competitor.quantity),
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.3,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navyDeep,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (onEdit != null)
            TextButton(
              onPressed: () => onEdit!(null),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                alignment: Alignment.centerLeft,
                minimumSize: const Size(0, 34),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Adicionar concorrente'),
            ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            height: 1.25,
            fontWeight: FontWeight.w500,
            color: AppColors.gray500,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            height: 1.2,
            fontWeight: FontWeight.w700,
            color: AppColors.navyDeep,
          ),
        ),
      ],
    );
  }
}

String _fmtQty(double? value) {
  if (value == null) return '—';
  if (value == value.roundToDouble()) return value.toStringAsFixed(0);
  return value.toStringAsFixed(1);
}

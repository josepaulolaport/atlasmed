import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Histórico de visitas" — stats row, sentiment filter pills and a rich
/// visit timeline (attendees, sample given, linked order, summary).
///
/// Mock-only in V1: the real `clinicVisitsRepositoryProvider` (visitedAt/type/summary)
/// still backs "Nova visita" registration elsewhere on the screen; this
/// section renders `EstablishmentDetailSections.visitTimeline`, which will
/// be replaced by real, richer visit data once the backend model is
/// extended (Phase 2 — see Spec 0005).
class ClinicVisitHistorySection extends StatefulWidget {
  const ClinicVisitHistorySection({
    super.key,
    required this.entries,
    this.stats,
  });

  final List<VisitTimelineEntry> entries;
  final VisitStats? stats;

  @override
  State<ClinicVisitHistorySection> createState() =>
      _ClinicVisitHistorySectionState();
}

class _ClinicVisitHistorySectionState extends State<ClinicVisitHistorySection> {
  VisitSentiment? _filter;

  @override
  Widget build(BuildContext context) {
    if (widget.entries.isEmpty) {
      return const ClinicaEmptySection(
        icon: Icons.checklist_outlined,
        title: 'Nenhuma visita registrada',
        description: 'Registre visitas à clínica para acompanhamento.',
      );
    }

    final filtered = _filter == null
        ? widget.entries
        : widget.entries.where((e) => e.sentiment == _filter).toList();

    return ClinicDetailCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.stats != null) ...[
            _StatsRow(stats: widget.stats!),
            const SizedBox(height: 14),
          ],
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterPill(
                  label: 'Todas (${widget.entries.length})',
                  selected: _filter == null,
                  onTap: () => setState(() => _filter = null),
                ),
                const SizedBox(width: 8),
                for (final sentiment in VisitSentiment.values) ...[
                  _FilterPill(
                    label:
                        '${sentiment.label} (${widget.entries.where((e) => e.sentiment == sentiment).length})',
                    selected: _filter == sentiment,
                    onTap: () => setState(() => _filter = sentiment),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Nenhum registro encontrado',
                  style: TextStyle(fontSize: 13, color: AppColors.gray400),
                ),
              ),
            )
          else
            ...filtered.map(
              (e) => _VisitEntryRow(entry: e, isLast: e == filtered.last),
            ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});

  final VisitStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Stat(
          label: 'Visitas',
          value: '${stats.visitCount}',
          caption: stats.periodLabel,
        ),
        _Stat(
          label: 'Pedidos',
          value: 'R\$ ${stats.totalOrdersValue.toStringAsFixed(0)}',
        ),
        _Stat(
          label: 'Duração média',
          value: '${stats.avgDurationMinutes} min',
          caption: 'por visita',
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.caption});

  final String label;
  final String value;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          if (caption != null)
            Text(
              caption!,
              style: const TextStyle(fontSize: 10, color: AppColors.gray400),
            ),
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.navyBright : AppColors.surfaceSecondary,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : AppColors.gray500,
          ),
        ),
      ),
    );
  }
}

class _VisitEntryRow extends StatelessWidget {
  const _VisitEntryRow({required this.entry, required this.isLast});

  final VisitTimelineEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    final color = entry.sentiment.color;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 44,
              child: Column(
                children: [
                  Text(
                    '${entry.date.day}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                  Text(
                    monthsShort(entry.date.month, months),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray500,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              width: 24,
              child: Column(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 1,
                        color: AppColors.surfaceSecondary,
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            entry.title,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.gray900,
                            ),
                          ),
                        ),
                        if (entry.durationMinutes != null)
                          Text(
                            '${entry.durationMinutes} min',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.gray400,
                            ),
                          ),
                        if (entry.consultantInitials != null) ...[
                          const SizedBox(width: 6),
                          CircleAvatar(
                            radius: 10,
                            backgroundColor: AppColors.blueLight,
                            child: Text(
                              entry.consultantInitials!,
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navyBright,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (entry.attendees != null)
                      Text(
                        entry.attendees!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray500,
                        ),
                      ),
                    if (entry.sampleGiven != null)
                      Text(
                        'amostra: ${entry.sampleGiven}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray500,
                        ),
                      ),
                    if (entry.linkedOrderValue != null)
                      Text(
                        'pedido: R\$ ${entry.linkedOrderValue!.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.green,
                        ),
                      ),
                    if (entry.summary != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        entry.summary!,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray600,
                        ),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String monthsShort(int month, List<String> months) => months[month - 1];
}

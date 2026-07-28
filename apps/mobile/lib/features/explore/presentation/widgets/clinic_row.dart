import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_service_labels.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/status_chip.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicRow extends StatelessWidget {
  final FacilityEntry clinic;
  final VoidCallback onTap;

  const ClinicRow({super.key, required this.clinic, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final funnelStage = clinic.purchaseRecurrence?.funnelStage;
    final serviceChip = FacilityServiceLabels.chipSummary(
      clinic.displayServices,
    );

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.blue100, AppColors.blueLight],
                    ),
                  ),
                  child: const Icon(
                    Icons.local_hospital_rounded,
                    size: 22,
                    color: AppColors.navyBright,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    clinic.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  if (clinic.locationLabel != null) ...[
                    const SizedBox(height: 3),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 2),
                          child: Icon(
                            Icons.location_on_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            clinic.locationLabel!,
                            softWrap: true,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.gray500,
                              height: 1.25,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (clinic.distanceKm != null || clinic.doctorCount > 0) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (clinic.distanceKm != null) ...[
                          const Icon(
                            Icons.near_me_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${clinic.distanceKm!.toStringAsFixed(1)} km',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                              color: AppColors.gray500,
                            ),
                          ),
                        ],
                        if (clinic.distanceKm != null && clinic.doctorCount > 0)
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6),
                            child: Text(
                              '•',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.gray400,
                              ),
                            ),
                          ),
                        if (clinic.doctorCount > 0) ...[
                          const Icon(
                            Icons.person_outline_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '${clinic.doctorCount} ${clinic.doctorCount == 1 ? 'médico' : 'médicos'}',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                                color: AppColors.gray500,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (serviceChip.label != null) ...[
                        _ServiceChip(label: serviceChip.label!),
                        if (serviceChip.overflow > 0)
                          _ServiceChip(label: '+${serviceChip.overflow}'),
                      ] else
                        const _ServiceChip(
                          label: 'Sem especialidade',
                          muted: true,
                        ),
                    ],
                  ),
                  if (clinic.commercialStatus != null ||
                      funnelStage != null ||
                      clinic.lastVisitDays != null) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (clinic.commercialStatus != null)
                          StatusChip(
                            label: CommercialStatusFilter.label(
                              clinic.commercialStatus!,
                            ),
                            color: CommercialStatusFilter.color(
                              clinic.commercialStatus!,
                            ),
                            bg: CommercialStatusFilter.bg(
                              clinic.commercialStatus!,
                            ),
                            small: true,
                          ),
                        if (funnelStage != null)
                          StatusChip(
                            label: funnelStage.label,
                            color: funnelStage.color,
                            bg: funnelStage.backgroundColor,
                            small: true,
                          ),
                        if (clinic.lastVisitDays != null)
                          _MetaItem(
                            icon: Icons.access_time_rounded,
                            text: clinic.lastVisitDays == 0
                                ? 'Hoje'
                                : 'Há ${clinic.lastVisitDays} dia${clinic.lastVisitDays == 1 ? '' : 's'}',
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({required this.label, this.muted = false});

  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final bg = muted
        ? AppColors.gray100
        : AppColors.navyBright.withValues(alpha: 0.08);
    final border = muted
        ? AppColors.gray200
        : AppColors.navyBright.withValues(alpha: 0.18);
    final fg = muted ? AppColors.gray500 : AppColors.navyDeep;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          color: fg,
          height: 1.1,
        ),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.gray500),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
        ),
      ],
    );
  }
}

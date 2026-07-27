import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/status_chip.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicRow extends StatelessWidget {
  final FacilityEntry clinic;
  final VoidCallback onTap;

  const ClinicRow({super.key, required this.clinic, required this.onTap});

  @override
  Widget build(BuildContext context) {
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
                    overflow: TextOverflow.ellipsis,
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
                  if (clinic.distanceKm != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      '${clinic.distanceKm!.toStringAsFixed(1)} km',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
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
                      if (clinic.purchaseRecurrence?.funnelStage != null)
                        _PurchaseFunnelChip(
                          stage: clinic.purchaseRecurrence!.funnelStage!,
                          intervalDays: clinic.purchaseRecurrence!.intervalDays,
                        ),
                      if (clinic.lastVisitDays != null)
                        _MetaItem(
                          icon: Icons.access_time_rounded,
                          text: clinic.lastVisitDays == 0
                              ? 'Hoje'
                              : 'Há ${clinic.lastVisitDays} dia${clinic.lastVisitDays == 1 ? '' : 's'}',
                        ),
                      _MetaItem(
                        icon: Icons.person_outline_rounded,
                        text:
                            '${clinic.doctorCount} ${clinic.doctorCount == 1 ? 'médico' : 'médicos'}',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PurchaseFunnelChip extends StatelessWidget {
  const _PurchaseFunnelChip({required this.stage, required this.intervalDays});

  final PurchaseFunnelStage stage;
  final int intervalDays;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: stage.backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            stage.label,
            style: TextStyle(
              color: stage.color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            'A cada $intervalDays dias',
            style: TextStyle(color: stage.color, fontSize: 10),
          ),
        ],
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

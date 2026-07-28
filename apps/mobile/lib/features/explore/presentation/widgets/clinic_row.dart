import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

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
                          Text(
                            '${clinic.doctorCount} ${clinic.doctorCount == 1 ? 'médico' : 'médicos'}',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                              color: AppColors.gray500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                  // TODO(yanncabral): uncomment when the filters are back
                  // if (clinic.purchaseRecurrence?.funnelStage != null)
                  //   const SizedBox(height: 8),
                  // if (clinic.purchaseRecurrence?.funnelStage != null)
                  //   _RecompraContainer(recurrence: clinic.purchaseRecurrence!),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _RecompraLabelStyle { normal, atrasado, churn, inativo }

extension on _RecompraLabelStyle {
  Color get color => switch (this) {
    _RecompraLabelStyle.normal => AppColors.green600,
    _RecompraLabelStyle.atrasado => AppColors.amberDark,
    _RecompraLabelStyle.churn => AppColors.redDark,
    _RecompraLabelStyle.inativo => AppColors.gray500,
  };

  Color get bg => color.withValues(alpha: 0.08);
  Color get border => color.withValues(alpha: 0.2);
}

_RecompraLabelStyle? _resolveStyle(PurchaseRecurrenceSnapshot pr) {
  switch (pr.funnelStage) {
    case PurchaseFunnelStage.purchaseWindow:
      return _RecompraLabelStyle.normal;
    case PurchaseFunnelStage.outsideWindow:
      return _RecompraLabelStyle.atrasado;
    case PurchaseFunnelStage.churn:
      return _RecompraLabelStyle.churn;
    case PurchaseFunnelStage.neverPurchased:
    case PurchaseFunnelStage.inactive:
      return _RecompraLabelStyle.inativo;
    case null:
      return null;
  }
}

String? _resolveLabel(PurchaseRecurrenceSnapshot pr) {
  final now = DateTime.now();
  switch (pr.funnelStage) {
    case PurchaseFunnelStage.purchaseWindow:
      if (pr.nextTransitionDate != null) {
        final days = pr.nextTransitionDate!.difference(now).inDays;
        if (days >= 0) {
          return 'Recompra prevista em $days dia${days == 1 ? '' : 's'}';
        }
      }
      if (pr.lastPurchaseDate != null && pr.intervalDays > 0) {
        final daysSince = now.difference(pr.lastPurchaseDate!).inDays;
        final remaining = pr.intervalDays - daysSince;
        if (remaining >= 0) {
          return 'Recompra prevista em $remaining dia${remaining == 1 ? '' : 's'}';
        }
      }
      return 'Período de compra';
    case PurchaseFunnelStage.outsideWindow:
      if (pr.lastPurchaseDate != null) {
        final daysSince = now.difference(pr.lastPurchaseDate!).inDays;
        return 'Recompra atrasada há $daysSince dia${daysSince == 1 ? '' : 's'}';
      }
      return 'Fora do período';
    case PurchaseFunnelStage.churn:
      return 'Risco de churn';
    case PurchaseFunnelStage.neverPurchased:
    case PurchaseFunnelStage.inactive:
      return 'Inativo';
    case null:
      return null;
  }
}

// ignore: unused_element
class _RecompraContainer extends StatelessWidget {
  final PurchaseRecurrenceSnapshot recurrence;

  const _RecompraContainer({required this.recurrence});

  @override
  Widget build(BuildContext context) {
    final style = _resolveStyle(recurrence);
    final label = _resolveLabel(recurrence);
    if (style == null || label == null) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: style.color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: style.color,
            ),
          ),
        ],
      ),
    );
  }
}

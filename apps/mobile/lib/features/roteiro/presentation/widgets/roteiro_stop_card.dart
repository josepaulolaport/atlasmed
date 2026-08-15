import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// One clinic in the day, with the reasons it is there.
///
/// The reasons are the feature. A ranked list without them is a black box a rep
/// has no way to disagree with, and every reason on this card traces to a
/// component the server sent (spec 0016 §5.2).
class RoteiroStopCard extends StatelessWidget {
  const RoteiroStopCard({
    super.key,
    required this.stop,
    required this.estimatedTravel,
    this.onTap,
  });

  final RoteiroStop stop;

  /// P1 has no Matrix call, so travel is a straight-line estimate and says so.
  final bool estimatedTravel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final travel = stop.travelSecondsFromPrev;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.gray200),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (travel != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.directions_car_outlined,
                          size: 14, color: AppColors.gray500),
                      const SizedBox(width: 6),
                      Text(
                        '${(travel / 60).round()} min de deslocamento'
                        '${estimatedTravel ? ' (estimado)' : ''}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.gray500),
                      ),
                    ],
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PositionBadge(position: stop.position + 1),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.facilityName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray900,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [
                            '${_hhmm(stop.plannedStartsAt)}–${_hhmm(stop.plannedEndsAt)}',
                            if (stop.municipality != null) stop.municipality!,
                            if (stop.straightLineKm != null)
                              '${stop.straightLineKm!.toStringAsFixed(1)} km',
                          ].join(' · '),
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.gray500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  // Never colour alone — every chip carries its own text, per
                  // PRODUCT.md's accessibility rule.
                  _Chip(label: stop.bucket.label, color: stop.bucket.color),
                  _Chip(
                    label: stop.modality.label,
                    color: AppColors.gray600,
                    icon: stop.modality.icon,
                  ),
                  if (stop.isAnchor)
                    const _Chip(label: 'Já combinada', color: AppColors.purple),
                  if (stop.isCoverageSlot)
                    const _Chip(label: 'Cobertura', color: AppColors.blueDark),
                ],
              ),
              const SizedBox(height: 10),
              ...stop.reasons.take(3).map(
                    (reason) => Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 5, right: 8),
                            child: Icon(Icons.circle,
                                size: 5, color: AppColors.gray400),
                          ),
                          Expanded(
                            child: Text(
                              reason,
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.gray700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PositionBadge extends StatelessWidget {
  const _PositionBadge({required this.position});

  final int position;

  @override
  Widget build(BuildContext context) => Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.navyBright,
          shape: BoxShape.circle,
        ),
        child: Text(
          '$position',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600, color: color),
            ),
          ],
        ),
      );
}

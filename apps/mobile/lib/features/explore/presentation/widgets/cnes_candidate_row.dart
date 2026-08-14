import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// A CNES establishment in the import list.
///
/// Deliberately the same shape as [ClinicRow]: the same 44px rounded avatar, the
/// same 20/14 padding, the same hairline separator, the same type scale. The
/// CNES list is a different *source*, not a different kind of thing, and a rep
/// moving between Explorar and this screen should not have to re-learn how a
/// clinic looks.
///
/// It carries a `cnesCode` where a clinic row carries distance and status chips,
/// because that is the identifier this surface is searched by.
class CnesCandidateRow extends StatelessWidget {
  const CnesCandidateRow({
    super.key,
    required this.candidate,
    required this.onTap,
  });

  final CnesFacilityCandidate candidate;
  final VoidCallback onTap;

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
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    candidate.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  if (candidate.whereLabel.isNotEmpty) ...[
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
                            candidate.whereLabel,
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
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _Tag(
                        icon: Icons.badge_outlined,
                        label: 'CNES ${candidate.cnesCode}',
                      ),
                      if ((candidate.unitTypeName ?? '').isNotEmpty)
                        _Tag(label: candidate.unitTypeName!),
                      /*
                       * The one thing the row must say. Importing this adds a
                       * vertical profile to a clinic we already hold rather than
                       * creating one, and the outcome differs enough that the
                       * row has to differ too.
                       */
                      if (candidate.imported)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.blueLight,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Já cadastrada · adiciona à sua vertical',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.navyBright,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(top: 12, left: 4),
              child: Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.gray400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 11, color: AppColors.gray500),
          const SizedBox(width: 4),
        ],
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
            color: AppColors.gray500,
          ),
        ),
      ],
    );
  }
}

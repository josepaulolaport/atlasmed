import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// CPF clinics needing attention, on Desempenho.
///
/// Renders nothing when both counts are zero: a card reading "0 pendentes"
/// would occupy the slot permanently and train reps to stop reading it.
///
/// One row per non-zero count rather than a single total, because the two need
/// different work — [DashboardCpfIssues.missing] means finding out the CPF,
/// [DashboardCpfIssues.invalid] means correcting one already on file. A merged
/// number would send the rep into the list to work out which they were looking
/// at.
class CpfWarningCard extends StatelessWidget {
  const CpfWarningCard({super.key, required this.issues, this.onTapStatus});

  final DashboardCpfIssues issues;

  /// Opens the clinics list for `missing` or `invalid`.
  final ValueChanged<String>? onTapStatus;

  @override
  Widget build(BuildContext context) {
    if (issues.isClear) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  size: 18,
                  color: AppColors.amber,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'CPF pendente',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                ),
                Text(
                  '${issues.total}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.amber,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFf3f4f6)),
          if (issues.missing > 0)
            _IssueRow(
              label: 'Sem CPF cadastrado',
              count: issues.missing,
              onTap: onTapStatus == null
                  ? null
                  : () => onTapStatus!(CpfWarningCard.missingStatus),
            ),
          if (issues.missing > 0 && issues.invalid > 0)
            const Divider(height: 1, color: Color(0xFFf3f4f6)),
          if (issues.invalid > 0)
            _IssueRow(
              label: 'CPF inválido',
              count: issues.invalid,
              onTap: onTapStatus == null
                  ? null
                  : () => onTapStatus!(CpfWarningCard.invalidStatus),
            ),
        ],
      ),
    );
  }

  /// The `cpfStatus` values the API accepts. Kept here so the card, the route
  /// and the query cannot disagree about their spelling.
  static const missingStatus = 'missing';
  static const invalidStatus = 'invalid';
}

class _IssueRow extends StatelessWidget {
  const _IssueRow({required this.label, required this.count, this.onTap});

  final String label;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0f1729),
                  ),
                ),
              ),
              Text(
                '$count',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 2),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: AppColors.gray400,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

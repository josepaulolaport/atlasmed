import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// What the rep chose when saying a visit did not happen.
///
/// [reason] is null when they skipped the question — which is still an answer,
/// and still better than the day ending with nobody having said anything.
class MissedVisitAnswer {
  const MissedVisitAnswer({this.reason});
  final InteractionMissReason? reason;
}

/// "Não fui" — spec 0016 §15.7.7.
///
/// Offered, never required. A rep made to justify a miss before it will save
/// simply presses nothing, and then the day's sweep marks the visit missed with
/// no reason at all: strictly worse than the miss they were willing to declare.
/// So *Registrar sem motivo* is a real button, not a hidden escape.
Future<MissedVisitAnswer?> showMissedVisitSheet(
  BuildContext context, {
  required String subject,
}) => showModalBottomSheet<MissedVisitAnswer>(
  context: context,
  isScrollControlled: true,
  backgroundColor: AppColors.cardBg,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
  ),
  builder: (sheetContext) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            subject,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'O que aconteceu?',
            style: TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
          const SizedBox(height: 14),
          for (final reason in InteractionMissReason.values)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                key: Key('missed-${reason.wire}'),
                onPressed: () => Navigator.of(
                  sheetContext,
                ).pop(MissedVisitAnswer(reason: reason)),
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  foregroundColor: AppColors.gray900,
                  side: const BorderSide(color: AppColors.surfaceSecondary),
                ),
                child: Text(reason.label),
              ),
            ),
          const SizedBox(height: 4),
          TextButton(
            key: const Key('missed-no-reason'),
            onPressed: () =>
                Navigator.of(sheetContext).pop(const MissedVisitAnswer()),
            child: const Text('Registrar sem motivo'),
          ),
        ],
      ),
    ),
  ),
);

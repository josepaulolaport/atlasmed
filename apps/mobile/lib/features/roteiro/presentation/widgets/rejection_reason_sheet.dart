import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Asks why, the **second** time a rep turns the same clinic down.
///
/// Never the first. One removal is a shrug: the same tap means "not here" and
/// "not today", and a rep dropping a good clinic because Monday is a bad drive
/// is telling us about their calendar, not about the clinic. Asking every time
/// buys worse data, not more — the sheet becomes something to dismiss.
///
/// Dismissible without answering, on purpose. The removal has already happened
/// and stands regardless; this is a question, not a toll.
Future<RoteiroRejectionReason?> showRejectionReasonSheet(
  BuildContext context, {
  required String facilityName,
}) {
  return showModalBottomSheet<RoteiroRejectionReason>(
    context: context,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
            child: Text(
              'Você já tinha tirado $facilityName do roteiro',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Text(
              'O que houve? Isso muda o que vamos sugerir para você.',
              style: TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          ),
          for (final reason in RoteiroRejectionReason.values)
            ListTile(
              dense: true,
              title: Text(
                reason.label,
                style: const TextStyle(fontSize: 14, color: AppColors.gray800),
              ),
              // Said out loud, because it is a bigger action than the others:
              // a closed clinic leaves everyone's book, not just this rep's.
              subtitle: reason == RoteiroRejectionReason.fechada
                  ? const Text(
                      'Sai das sugestões de toda a equipe',
                      style: TextStyle(fontSize: 11, color: AppColors.gray500),
                    )
                  : null,
              onTap: () => Navigator.of(sheetContext).pop(reason),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: TextButton(
              onPressed: () => Navigator.of(sheetContext).pop(),
              child: const Text('Agora não'),
            ),
          ),
        ],
      ),
    ),
  );
}

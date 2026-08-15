import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/clinic_assignment_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// The motivo for ending an assignment, chosen from a fixed list (spec 0015 R7).
///
/// Free text was the alternative and the wrong one: `end_reason` is kept forever
/// (I5) and is the only account of why a clinic left a rep, so churn that cannot
/// be aggregated is churn that cannot be explained later.
///
/// Shared rather than owned by one screen, because a clinic can be taken off a
/// rep from two places. It used to be private to the Desempenho breakdown, and
/// the clinic detail's own "Remover" asked nothing and sent nothing — so the
/// server fell back to `manual_unassign`, the catch-all that means *reason
/// unrecorded*. Two doors onto one fact, and only one of them wrote it down.
class UnassignReasonDialog extends StatefulWidget {
  const UnassignReasonDialog({
    super.key,
    required this.clinicName,
    this.memberName,
  });

  final String clinicName;

  /// Whose caseload it is leaving, when the screen knows. Null reads as "will
  /// no longer have a representative" — true of a clinic-side removal, where
  /// the point is the clinic rather than the person.
  final String? memberName;

  /// Returns the chosen reason, or null when dismissed.
  static Future<UnassignReason?> show(
    BuildContext context, {
    required String clinicName,
    String? memberName,
  }) {
    return showDialog<UnassignReason>(
      context: context,
      builder: (context) =>
          UnassignReasonDialog(clinicName: clinicName, memberName: memberName),
    );
  }

  @override
  State<UnassignReasonDialog> createState() => _UnassignReasonDialogState();
}

class _UnassignReasonDialogState extends State<UnassignReasonDialog> {
  UnassignReason _reason = UnassignReason.repChanged;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Desassociar clínica'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.memberName == null
                ? '${widget.clinicName} deixará de ter representante.'
                : '${widget.clinicName} deixará de estar com ${widget.memberName}.',
            style: const TextStyle(fontSize: 13.5, height: 1.35),
          ),
          const SizedBox(height: 12),
          const Text(
            'Motivo',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.gray500,
            ),
          ),
          RadioGroup<UnassignReason>(
            groupValue: _reason,
            onChanged: (value) => setState(() => _reason = value!),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final reason in UnassignReason.values)
                  RadioListTile<UnassignReason>(
                    value: reason,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      reason.label,
                      style: const TextStyle(fontSize: 13.5),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        // Filled, like every other confirm in the app, and red because this
        // one ends something. The shape says "this is the button"; the colour
        // says "and it is the destructive one". Splitting those signals is how
        // the clinic detail ended up with its destructive action rendered
        // quieter than the neutral one beside it.
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppColors.red),
          onPressed: () => Navigator.of(context).pop(_reason),
          child: const Text('Desassociar'),
        ),
      ],
    );
  }
}

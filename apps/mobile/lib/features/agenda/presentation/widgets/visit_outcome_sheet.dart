import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// What the rep answers on the way out — spec 0016 §15.6.4.
class VisitOutcomeAnswers {
  const VisitOutcomeAnswers({required this.outcome, required this.followUp});

  final InteractionOutcome outcome;
  final InteractionFollowUp followUp;
}

/// Two questions, every answer one tap.
///
/// Two rather than three. "Conseguiu falar com quem queria" folded into the
/// outcome — *não falei com ninguém* is the failed-visit case and belongs on
/// the same list. Every question at the end of a visit is friction on the one
/// loop that has never yet run, so a question that folds into another has to.
///
/// Dismissible without answering. The visit is already recorded; this is a
/// question, not a toll, and a rep in a car park should be able to walk away
/// from it. Unanswered is a real state the model carries.
Future<VisitOutcomeAnswers?> showVisitOutcomeSheet(
  BuildContext context, {
  required String facilityName,
}) {
  return showModalBottomSheet<VisitOutcomeAnswers>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.cardBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (_) => _VisitOutcomeSheet(facilityName: facilityName),
  );
}

class _VisitOutcomeSheet extends StatefulWidget {
  const _VisitOutcomeSheet({required this.facilityName});

  final String facilityName;

  @override
  State<_VisitOutcomeSheet> createState() => _VisitOutcomeSheetState();
}

class _VisitOutcomeSheetState extends State<_VisitOutcomeSheet> {
  InteractionOutcome? _outcome;
  InteractionFollowUp? _followUp;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.facilityName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 18),
              const _Question('Como foi?'),
              const SizedBox(height: 8),
              for (final option in InteractionOutcome.values)
                _AnswerTile(
                  label: option.label,
                  selected: _outcome == option,
                  onTap: () => setState(() => _outcome = option),
                ),
              const SizedBox(height: 18),
              const _Question('Quando voltar?'),
              const SizedBox(height: 8),
              for (final option in InteractionFollowUp.values)
                _AnswerTile(
                  label: option.label,
                  selected: _followUp == option,
                  onTap: () => setState(() => _followUp = option),
                ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _outcome == null || _followUp == null
                    ? null
                    : () => Navigator.of(context).pop(
                        VisitOutcomeAnswers(
                          outcome: _outcome!,
                          followUp: _followUp!,
                        ),
                      ),
                child: const Text('Salvar'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Agora não'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Question extends StatelessWidget {
  const _Question(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: AppColors.gray600,
    ),
  );
}

class _AnswerTile extends StatelessWidget {
  const _AnswerTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.navyBright.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.navyBright : AppColors.gray300,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected ? AppColors.navyDeep : AppColors.gray800,
                ),
              ),
            ),
            if (selected)
              const Icon(
                Icons.check_circle,
                size: 18,
                color: AppColors.navyBright,
              ),
          ],
        ),
      ),
    ),
  );
}

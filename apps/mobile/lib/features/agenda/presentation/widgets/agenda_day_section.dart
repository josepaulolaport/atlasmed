import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_item.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:flutter/material.dart';

class AgendaDaySection extends StatelessWidget {
  const AgendaDaySection({
    super.key,
    required this.group,
    this.onOccurrenceTap,
  });

  final AgendaDayGroup group;
  final ValueChanged<CalendarOccurrence>? onOccurrenceTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 68, bottom: 2),
            child: Text(
              formatAgendaDay(group.date),
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.navyDeep,
              ),
            ),
          ),
          for (var index = 0; index < group.items.length; index++) ...[
            AgendaItem(
              occurrence: group.items[index],
              onTap: group.items[index].interaction != null
                  ? () => InteractionDetailRoute(
                      id: group.items[index].interaction!.id,
                    ).push(context)
                  : group.items[index].canMutate && onOccurrenceTap != null
                  ? () => onOccurrenceTap!(group.items[index])
                  : null,
            ),
            if (index < group.items.length - 1)
              const Padding(
                padding: EdgeInsets.only(left: 68),
                child: Divider(height: 1, color: AppColors.gray200),
              ),
          ],
        ],
      ),
    );
  }
}

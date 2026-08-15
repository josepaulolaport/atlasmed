import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_grid.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_speed_dial.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _weekdayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const _monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/// One day, as an hour grid — reached by tapping a day in the month view.
///
/// The month answers "how is my month shaped"; this answers "what am I doing,
/// when, and what still fits". The second question is the one roteirização
/// needs the rep to have an opinion about, which is why the "+" reaches it from
/// here.
class AgendaDayScreen extends ConsumerWidget {
  const AgendaDayScreen({super.key, required this.day});

  final DateTime day;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = DateTime(day.year, day.month, day.day);
    final agenda = ref.watch(
      agendaProvider(
        AgendaQuery(from: start, to: start.add(const Duration(days: 1))),
      ),
    );
    final role = ref.watch(currentUserProvider).valueOrNull?.role.name;
    final canCreate = role == UserRoleName.admin || role == UserRoleName.rep;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        title: Text(
          '${_monthNames[start.month - 1]} ${start.year}',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppColors.gray900,
          ),
        ),
      ),
      body: Column(
        children: [
          _DayHeader(day: start, count: agenda.valueOrNull?.length ?? 0),
          Expanded(
            child: agenda.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Não foi possível carregar a agenda.\n$error',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.gray600,
                    ),
                  ),
                ),
              ),
              data: (occurrences) => AgendaDayGrid(
                day: start,
                occurrences: occurrences,
                onOccurrenceTap: (occurrence) {
                  final interactionId = occurrence.interaction?.id;
                  // Personal blocks have no interaction to open.
                  if (interactionId == null) return;
                  InteractionDetailRoute(id: interactionId).push(context);
                },
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: canCreate ? _dial(context, start) : null,
    );
  }

  Widget _dial(BuildContext context, DateTime day) => AgendaSpeedDial(
    actions: [
      AgendaAction(
        label: 'Interação',
        icon: Icons.event_outlined,
        onTap: () => const AgendaNewRoute().push(context),
      ),
      AgendaAction(
        label: 'Bloqueio pessoal',
        icon: Icons.block_outlined,
        onTap: () => const AgendaNewRoute().push(context),
      ),
      AgendaAction(
        label: 'Roteiro do dia',
        icon: Icons.route_outlined,
        emphasis: true,
        onTap: () => const RoteiroRoute().push(context),
      ),
    ],
  );
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day, required this.count});

  final DateTime day;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.cardBg,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Text(
                  _weekdayNames[day.weekday - 1],
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                  ),
                ),
                Text(
                  '${day.day}',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              count == 0
                  ? 'Nada planejado'
                  : '$count ${count == 1 ? "compromisso" : "compromissos"}',
              style: const TextStyle(fontSize: 14, color: AppColors.gray600),
            ),
          ),
        ],
      ),
    );
  }
}

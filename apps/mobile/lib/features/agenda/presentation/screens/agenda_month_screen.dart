import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_month_grid.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_speed_dial.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The agenda's landing screen: a month at a glance.
///
/// A month first, a day on tap. The week list this replaces answered neither
/// question well — too coarse to plan an afternoon, too fine to see where the
/// month is empty, which is exactly what a rep needs to know before asking for
/// suggestions.
class AgendaMonthScreen extends ConsumerStatefulWidget {
  const AgendaMonthScreen({super.key, this.ownerUserId, this.ownerName});

  /// Whose agenda. Null means the caller's own — a manager viewing a rep's
  /// passes theirs, and the backend refuses an owner outside scope.
  final int? ownerUserId;
  final String? ownerName;

  @override
  ConsumerState<AgendaMonthScreen> createState() => _AgendaMonthScreenState();
}

class _AgendaMonthScreenState extends ConsumerState<AgendaMonthScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  Widget build(BuildContext context) {
    // A month grid always shows six weeks, so the query covers the leading and
    // trailing days too — otherwise the last days of the previous month render
    // empty when they are not.
    final firstOfMonth = DateTime(_month.year, _month.month);
    final from = firstOfMonth.subtract(
      Duration(days: firstOfMonth.weekday % 7),
    );
    final agenda = ref.watch(
      agendaProvider(
        // Without ownerUserId a manager opening a rep's agenda from Equipe
        // sees their own month under the rep's name.
        AgendaQuery(
          from: from,
          to: from.add(const Duration(days: 42)),
          ownerUserId: widget.ownerUserId,
        ),
      ),
    );
    final role = ref.watch(currentUserProvider).valueOrNull?.role.name;
    // Looking at someone else's agenda is read-only: creating an event or a
    // roteiro writes to their calendar, which is theirs alone (§7.3).
    final canCreate =
        widget.ownerUserId == null &&
        (role == UserRoleName.admin || role == UserRoleName.rep);

    return Scaffold(
      backgroundColor: AppColors.cardBg,
      appBar: widget.ownerUserId == null
          ? const AtlasAppBar(page: 'Agenda')
          : AppBar(
              backgroundColor: AppColors.cardBg,
              elevation: 0,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Agenda',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                    ),
                  ),
                  if (widget.ownerName != null)
                    Text(
                      widget.ownerName!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray500,
                      ),
                    ),
                ],
              ),
            ),
      body: Column(
        children: [
          AgendaMonthStrip(
            selected: _month,
            onSelected: (month) => setState(() => _month = month),
          ),
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
              data: (occurrences) => AgendaMonthGrid(
                month: _month,
                occurrences: occurrences,
                onDayTap: (day) => AgendaDayRoute(
                  day.toIso8601String().substring(0, 10),
                  ownerUserId: widget.ownerUserId,
                  ownerName: widget.ownerName,
                ).push(context),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? AgendaSpeedDial(
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
                // Filled, and last so it sits nearest the thumb: it is the one
                // action that plans a whole day rather than adding a row to it.
                // From the month, the roteiro plans today — a rep who wants
                // another day opens that day first, which is where its own
                // context lives.
                //
                // Withheld entirely when the roteiro is off (AppConfig
                // .roteiroEnabled): an action that opens a screen the build
                // does not offer is worse than no action.
                if (AppConfig.roteiroEnabled)
                  AgendaAction(
                    label: 'Roteiro do dia',
                    icon: Icons.route_outlined,
                    emphasis: true,
                    onTap: () {
                      final now = DateTime.now();
                      RoteiroRoute(
                        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}',
                      ).push(context);
                    },
                  ),
              ],
            )
          : null,
    );
  }
}

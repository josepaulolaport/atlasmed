import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_grid.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/schedule_draft_sheet.dart';
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
class AgendaDayScreen extends ConsumerStatefulWidget {
  const AgendaDayScreen({
    super.key,
    required this.day,
    this.ownerUserId,
    this.ownerName,
  });

  final DateTime day;

  /// Whose agenda. Null means the caller's own.
  final int? ownerUserId;
  final String? ownerName;

  @override
  ConsumerState<AgendaDayScreen> createState() => _AgendaDayScreenState();
}

class _AgendaDayScreenState extends ConsumerState<AgendaDayScreen> {
  /// The block being drawn, held here rather than in the grid: the sheet below
  /// names and saves the same one, and two copies would disagree the moment a
  /// handle moved.
  DayGridDraft? _draft;
  bool _saving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final day = widget.day;
    final ownerUserId = widget.ownerUserId;
    final ownerName = widget.ownerName;
    final start = DateTime(day.year, day.month, day.day);
    final agenda = ref.watch(
      agendaProvider(
        // ownerUserId is load-bearing: without it a manager opening a rep's day
        // from Equipe sees their *own* appointments under the rep's name.
        AgendaQuery(
          from: start,
          to: start.add(const Duration(days: 1)),
          ownerUserId: ownerUserId,
        ),
      ),
    );
    final role = ref.watch(currentUserProvider).valueOrNull?.role.name;
    // Read-only when looking at someone else's day: planning it would write to
    // their calendar, which is theirs alone.
    final canCreate =
        ownerUserId == null &&
        (role == UserRoleName.admin || role == UserRoleName.rep);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${_monthNames[start.month - 1]} ${start.year}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            if (ownerName != null)
              Text(
                ownerName,
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
          ],
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
                draft: _draft,
                onDraftStarted: canCreate
                    ? (draft) => setState(() {
                        _draft = draft;
                        _error = null;
                      })
                    : null,
                onDraftChanged: canCreate
                    ? (draft) => setState(() => _draft = draft)
                    : null,
                onOccurrenceTap: (occurrence) {
                  final interactionId = occurrence.interaction?.id;
                  if (interactionId != null) {
                    InteractionDetailRoute(id: interactionId).push(context);
                    return;
                  }
                  // A personal block has no interaction, but it is still the
                  // rep's own event. Returning silently made the tap a dead
                  // one — nothing opened and nothing explained why.
                  //
                  // Only on their own agenda: editing someone else's block
                  // would write to their calendar, which is theirs alone —
                  // the same rule that hides the create controls above.
                  if (!canCreate) return;
                  AgendaOccurrenceEditRoute(
                    id: occurrence.calendarId,
                    recurrenceKey: occurrence.recurrenceKey,
                    $extra: occurrence,
                  ).push(context);
                },
              ),
            ),
          ),
          if (_draft != null)
            ScheduleDraftSheet(
              day: start,
              draft: _draft!,
              clashes: draftClashes(
                _draft!,
                start,
                agenda.valueOrNull ?? const [],
              ),
              saving: _saving,
              errorText: _error,
              onCancel: () => setState(() {
                _draft = null;
                _error = null;
              }),
              onSave: (value) => _save(value, start),
              onMoreOptions: (value) => _openFullEditor(value, start),
            ),
        ],
      ),
      // Hidden while a block is being drawn: the sheet already owns the bottom
      // of the screen, and a button floating over it offers a second way to
      // start something the rep is already in the middle of.
      floatingActionButton: canCreate && _draft == null
          ? _dial(context, start)
          : null,
    );
  }

  /// Saves through the editor's own notifier rather than a second write path.
  ///
  /// That is what makes the quick sheet safe: validation, the idempotency key
  /// and the conflict handling are the editor's, already written and already
  /// tested. A parallel save would be a second set of rules to keep in step,
  /// and the first thing to drift would be the one that refuses double-booking.
  Future<void> _save(ScheduleDraftValue value, DateTime start) async {
    final draft = _draft;
    if (draft == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    // Built here rather than read from `calendarEditorProvider`, which is an
    // autoDispose family: nothing watches it from a callback, so Riverpod tore
    // the notifier down inside the same frame. The POST still went out and
    // returned 200 — the appointment was created — but the reply landed on a
    // disposed object, so the sheet span forever and a second tap would have
    // made a duplicate under a fresh idempotency key.
    final notifier = CalendarEditorNotifier(
      repository: ref.read(calendarMutationRepositoryProvider),
      target: CalendarEditorTarget.creating(
        prefill: CalendarEditorPrefill(
          kind: value.kind,
          title: value.title,
          facilityId: value.facility?.id,
          facilityName: value.facility?.name,
          startsAt: draft.startsAt(start),
          durationMinutes: draft.durationMinutes,
        ),
      ),
    );

    // `state` is protected on a StateNotifier, so the error is read through
    // the stream the notifier already exposes rather than by reaching inside.
    String? lastError;
    final subscription = notifier.stream.listen(
      (value) => lastError = value.errorMessage,
    );

    try {
      final saved = await notifier.submit();
      if (!mounted) return;
      if (saved) {
        setState(() {
          _saving = false;
          _draft = null;
        });
        ref.invalidate(
          agendaProvider(
            AgendaQuery(
              from: start,
              to: start.add(const Duration(days: 1)),
              ownerUserId: widget.ownerUserId,
            ),
          ),
        );
        return;
      }
      setState(() {
        _saving = false;
        _error = lastError ?? 'Não foi possível salvar.';
      });
    } finally {
      await subscription.cancel();
      notifier.dispose();
    }
  }

  /// Hands the block to the full editor, carrying what the rep already typed.
  void _openFullEditor(ScheduleDraftValue value, DateTime start) {
    final draft = _draft;
    if (draft == null) return;
    setState(() => _draft = null);
    AgendaNewRoute(
      title: value.title.isEmpty ? null : value.title,
      facilityId: value.facility?.id,
      facilityName: value.facility?.name,
      startsAt: draft.startsAt(start).toIso8601String(),
      durationMinutes: draft.durationMinutes,
    ).push(context);
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
        onTap: () => RoteiroRoute(
          '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}',
        ).push(context),
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

import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/calendar_editor_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_grid.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_grid_geometry.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/day_schedule_picker.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/pending_captures_banner.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/visit_actions.dart';
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

  /// When the rep's day starts, resolved during `build`.
  ///
  /// Watched rather than read from the callback: `ref.read` on a provider
  /// nothing on this screen watches returns loading the first time, so the
  /// speed dial silently fell back to the linha's 08:00 and then opened a form
  /// that labelled 08:00 "fora" against the rep's own 10:00.
  int _workdayStartMinutes = kLinhaWorkdayStartMinutes;

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
    _workdayStartMinutes =
        parseHhMmMinutes(
          ref.watch(userPreferencesValueProvider).valueOrNull?.workdayStart,
        ) ??
        kLinhaWorkdayStartMinutes;
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
        actions: [
          // The day had no way to reload itself. Not a nicety: the same query
          // is watched by "Meus compromissos hoje" on Desempenho, which never
          // leaves the tree, so today's agenda is pinned in memory and stays
          // whatever it was when the app started — through a visit recorded
          // from a clinic page, a queue that drained, or a manager's change.
          //
          // A button rather than pull-to-refresh: the grid opens at the working
          // day, so an overscroll gesture is eight hours of scrolling away.
          IconButton(
            key: const Key('agenda-day-refresh'),
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.invalidate(
              agendaProvider(
                AgendaQuery(
                  from: start,
                  to: start.add(const Duration(days: 1)),
                  ownerUserId: ownerUserId,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          _DayHeader(day: start, count: agenda.valueOrNull?.length ?? 0),
          // Captures still waiting for signal (§15.6.6-4). Sits above the day
          // because it is about the day: a visit recorded in a basement is
          // part of it whether or not the server has heard about it yet.
          const PendingCapturesBanner(),
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
                    // Its own day, and a visit that can be started or ended:
                    // offer that here rather than making the rep open the
                    // visit to find the button. The planned path had no entry
                    // point of its own — Cheguei only existed on the clinic's
                    // profile, which is the improvised path.
                    if (canCreate) {
                      _offerVisitActions(occurrence, interactionId);
                      return;
                    }
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
                  _openEditor(occurrence);
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
        // Read straight off the notifier: the conflict the server explained is
        // the whole value of this message.
        _error = notifier.errorMessage ?? 'Não foi possível salvar.';
      });
    } finally {
      notifier.dispose();
    }
  }

  /// What the rep can do with a planned visit, from the day itself.
  ///
  /// A sheet rather than a straight jump: "Cheguei" is the common press but it
  /// is not the only one, and a tap that silently started a visit would be a
  /// tap nobody could take back.
  Future<void> _offerVisitActions(
    CalendarOccurrence occurrence,
    int interactionId,
  ) async {
    final status = occurrence.interaction?.status;
    final running = status == InteractionStatus.inProgress;
    final startable = status == InteractionStatus.scheduled;
    final name = occurrence.facility?.name ?? occurrence.title;

    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
            ),
            if (startable)
              ListTile(
                key: const Key('day-visit-start'),
                leading: const Icon(
                  Icons.where_to_vote_rounded,
                  color: AppColors.green,
                ),
                title: const Text('Cheguei'),
                onTap: () => Navigator.of(sheetContext).pop('start'),
              ),
            if (running)
              ListTile(
                key: const Key('day-visit-finish'),
                leading: const Icon(Icons.stop_circle_outlined),
                title: const Text('Encerrar visita'),
                onTap: () => Navigator.of(sheetContext).pop('finish'),
              ),
            // Only while it is still only a plan. Once a visit has started or
            // finished, its time is a record of what happened and moving it is
            // a correction, which the interaction screen owns.
            if (startable)
              ListTile(
                key: const Key('day-visit-edit'),
                leading: const Icon(Icons.edit_calendar_outlined),
                title: Text(
                  occurrence.recurrence == CalendarRecurrence.none
                      ? 'Editar'
                      : 'Editar…',
                ),
                subtitle: occurrence.recurrence == CalendarRecurrence.none
                    ? null
                    : const Text('Esta ocorrência ou toda a série'),
                onTap: () => Navigator.of(sheetContext).pop('edit'),
              ),
            ListTile(
              key: const Key('day-visit-open'),
              leading: const Icon(Icons.open_in_new_rounded),
              title: const Text('Abrir detalhes'),
              onTap: () => Navigator.of(sheetContext).pop('open'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (action == null || !mounted) return;
    final version = occurrence.interaction?.version ?? 0;
    switch (action) {
      case 'start':
        await startPlannedVisit(
          context,
          ref,
          interactionId: interactionId,
          expectedVersion: version,
          facilityName: name,
        );
      case 'finish':
        await finishPlannedVisit(
          context,
          ref,
          interactionId: interactionId,
          expectedVersion: version,
          facilityName: name,
        );
      case 'edit':
        // Reaches the occurrence-vs-series chooser, and through it the series
        // editor. Before this the sheet intercepted every tap on a visit and
        // offered no way in, so "Editar toda a série" — and with it cancelling
        // a whole weekly series of visits — was unreachable for interactions.
        if (mounted) await _openEditor(occurrence);
      case 'open':
        if (mounted) InteractionDetailRoute(id: interactionId).push(context);
    }
    if (mounted) ref.invalidate(agendaProvider);
  }

  /// Opens the right editor for [occurrence], asking first when it repeats.
  ///
  /// Editing a *series* had no way in. `AgendaEditRoute` and the whole
  /// `CalendarEditorMode.series` branch existed — screen title, "Cancelar toda
  /// a série", its own expectedVersion rule, tests — and nothing in the app
  /// pushed it. A rep who set up a weekly block could only ever move or cancel
  /// one week at a time, for as long as the series ran.
  ///
  /// One-off appointments skip the question: there is no series to mean.
  Future<void> _openEditor(CalendarOccurrence occurrence) async {
    if (occurrence.recurrence == CalendarRecurrence.none) {
      AgendaOccurrenceEditRoute(
        id: occurrence.calendarId,
        recurrenceKey: occurrence.recurrenceKey,
        $extra: occurrence,
      ).push(context);
      return;
    }

    final wholeSeries = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: Text(
                'Este compromisso se repete.',
                style: TextStyle(fontSize: 14, color: AppColors.gray600),
              ),
            ),
            ListTile(
              key: const Key('edit-this-occurrence'),
              leading: const Icon(Icons.event_outlined),
              title: const Text('Esta ocorrência'),
              onTap: () => Navigator.of(sheetContext).pop(false),
            ),
            ListTile(
              key: const Key('edit-whole-series'),
              leading: const Icon(Icons.repeat_rounded),
              title: const Text('Toda a série'),
              onTap: () => Navigator.of(sheetContext).pop(true),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (wholeSeries == null || !mounted) return;
    if (wholeSeries) {
      AgendaEditRoute(
        id: occurrence.calendarId,
        // Not used to address the series — it dates the appointment, so it can
        // be found again when `$extra` is lost to a router refresh.
        recurrenceKey: occurrence.recurrenceKey,
        $extra: occurrence,
      ).push(context);
      return;
    }
    AgendaOccurrenceEditRoute(
      id: occurrence.calendarId,
      recurrenceKey: occurrence.recurrenceKey,
      $extra: occurrence,
    ).push(context);
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
      // The sheet asks Visita or Bloqueio pessoal before this button exists.
      // Leaving it behind reopened the answer as Interação, so a block drawn
      // and named as personal arrived in the editor asking for a clinic.
      personalBlock: value.kind == CalendarEventKind.personalBlock,
    ).push(context);
  }

  /// Where a new appointment on [day] should open.
  ///
  /// The rep navigated into a day; the form used to ignore that and open on
  /// today's next half hour, so planning next Tuesday from Tuesday's own grid
  /// quietly booked this afternoon. On today the next half hour is still the
  /// right answer; on any other day it is the start of their working day.
  DateTime _newAppointmentStart(DateTime day) {
    final now = DateTime.now();
    if (day.year == now.year && day.month == now.month && day.day == now.day) {
      final rounded = DateTime(
        now.year,
        now.month,
        now.day,
        now.hour,
        now.minute < 30 ? 30 : 0,
      );
      return now.minute >= 30 ? rounded.add(const Duration(hours: 1)) : rounded;
    }
    return day.add(Duration(minutes: _workdayStartMinutes));
  }

  Widget _dial(BuildContext context, DateTime day) => AgendaSpeedDial(
    actions: [
      AgendaAction(
        label: 'Interação',
        icon: Icons.event_outlined,
        onTap: () => AgendaNewRoute(
          startsAt: _newAppointmentStart(day).toIso8601String(),
        ).push(context),
      ),
      AgendaAction(
        label: 'Bloqueio pessoal',
        icon: Icons.block_outlined,
        // Both actions used to push the same bare route, so choosing a block
        // opened a form set to Interação with a clinic field to dismiss.
        onTap: () => AgendaNewRoute(
          personalBlock: true,
          startsAt: _newAppointmentStart(day).toIso8601String(),
        ).push(context),
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

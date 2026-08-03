import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AgendaScreen extends ConsumerStatefulWidget {
  const AgendaScreen({super.key, this.ownerPicker, this.onCreate})
    : _preview = null;

  AgendaScreen.content({
    super.key,
    required List<CalendarOccurrence> occurrences,
    required VoidCallback onPreviousPeriod,
    required VoidCallback onNextPeriod,
    required VoidCallback onToday,
    required VoidCallback onRefresh,
    this.ownerPicker,
    this.onCreate,
    DateTime? now,
  }) : _preview = _AgendaPreview.content(
         occurrences: occurrences,
         onPreviousPeriod: onPreviousPeriod,
         onNextPeriod: onNextPeriod,
         onToday: onToday,
         onRefresh: onRefresh,
         now: now,
       );

  const AgendaScreen.loading({super.key})
    : ownerPicker = null,
      onCreate = null,
      _preview = const _AgendaPreview.loading();

  AgendaScreen.error({
    super.key,
    required String message,
    required VoidCallback onRetry,
  }) : ownerPicker = null,
       onCreate = null,
       _preview = _AgendaPreview.error(errorMessage: message, onRetry: onRetry);

  final Widget? ownerPicker;
  final VoidCallback? onCreate;
  final _AgendaPreview? _preview;

  @override
  ConsumerState<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends ConsumerState<AgendaScreen> {
  late DateTime _periodStart;
  String _search = '';
  String? _selectedOwnerUserId;
  InteractionStatus? _selectedStatus;
  CalendarModality? _selectedModality;

  @override
  void initState() {
    super.initState();
    _periodStart = _startOfWeek(DateTime.now());
  }

  AgendaQuery get _query => AgendaQuery(
    from: _periodStart,
    to: _periodStart.add(const Duration(days: 7)),
    ownerUserId: _selectedOwnerUserId,
  );

  @override
  Widget build(BuildContext context) {
    final preview = widget._preview;
    if (preview != null) {
      return _AgendaScaffold(
        occurrences: _filtered(preview.occurrences),
        loading: preview.loading,
        errorMessage: preview.errorMessage,
        onRetry: preview.onRetry,
        periodStart: _startOfWeek(preview.now ?? DateTime.now()),
        ownerPicker: widget.ownerPicker,
        onCreate: widget.onCreate,
        onPreviousPeriod: preview.onPreviousPeriod,
        onNextPeriod: preview.onNextPeriod,
        onToday: preview.onToday,
        onRefresh: preview.onRefresh,
        onSearchChanged: _setSearch,
      );
    }

    final currentUser = ref.watch(currentUserProvider).valueOrNull;
    final isManager = currentUser?.role.name == UserRoleName.manager;
    final canCreate =
        currentUser != null &&
        (currentUser.role.name == UserRoleName.admin ||
            currentUser.role.name == UserRoleName.rep);
    final ownerPicker =
        widget.ownerPicker ?? (isManager ? _buildManagerFilters() : null);
    final createAction =
        widget.onCreate ??
        (canCreate ? () => context.push('/agenda/new') : null);
    final agenda = ref.watch(agendaProvider(_query));
    return agenda.when(
      loading: () => _AgendaScaffold(
        loading: true,
        periodStart: _periodStart,
        ownerPicker: ownerPicker,
        onCreate: createAction,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
        onSearchChanged: _setSearch,
        onOccurrenceTap: _editOccurrence,
      ),
      error: (error, _) => _AgendaScaffold(
        errorMessage: error.toString(),
        onRetry: _refresh,
        periodStart: _periodStart,
        ownerPicker: ownerPicker,
        onCreate: createAction,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
        onSearchChanged: _setSearch,
        onOccurrenceTap: _editOccurrence,
      ),
      data: (occurrences) => _AgendaScaffold(
        occurrences: _filtered(occurrences),
        periodStart: _periodStart,
        ownerPicker: ownerPicker,
        onCreate: createAction,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
        onSearchChanged: _setSearch,
        onOccurrenceTap: _editOccurrence,
      ),
    );
  }

  Widget _buildManagerFilters() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _buildManagerOwnerPicker(),
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<InteractionStatus?>(
              key: const Key('agenda-status-filter'),
              initialValue: _selectedStatus,
              isExpanded: true,
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Status',
              ),
              items: const [
                DropdownMenuItem(value: null, child: Text('Todos')),
                DropdownMenuItem(
                  value: InteractionStatus.scheduled,
                  child: Text('Agendada'),
                ),
                DropdownMenuItem(
                  value: InteractionStatus.inProgress,
                  child: Text('Em andamento'),
                ),
                DropdownMenuItem(
                  value: InteractionStatus.completed,
                  child: Text('Concluída'),
                ),
                DropdownMenuItem(
                  value: InteractionStatus.cancelled,
                  child: Text('Cancelada'),
                ),
                DropdownMenuItem(
                  value: InteractionStatus.notCompleted,
                  child: Text('Não realizada'),
                ),
              ],
              onChanged: (status) => setState(() => _selectedStatus = status),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonFormField<CalendarModality?>(
              key: const Key('agenda-modality-filter'),
              initialValue: _selectedModality,
              isExpanded: true,
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Modalidade',
              ),
              items: const [
                DropdownMenuItem(value: null, child: Text('Todas')),
                DropdownMenuItem(
                  value: CalendarModality.inPerson,
                  child: Text('Presencial'),
                ),
                DropdownMenuItem(
                  value: CalendarModality.remote,
                  child: Text('Remota'),
                ),
              ],
              onChanged: (modality) =>
                  setState(() => _selectedModality = modality),
            ),
          ),
        ],
      ),
    ],
  );

  Widget _buildManagerOwnerPicker() {
    final owners = ref.watch(agendaOwnerOptionsProvider);
    return owners.when(
      loading: () => const LinearProgressIndicator(
        minHeight: 2,
        semanticsLabel: 'Carregando representantes',
      ),
      error: (_, _) => const Text(
        'Não foi possível carregar os representantes.',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      data: (users) {
        if (users.isEmpty) {
          return const Text('Nenhum representante disponível.');
        }
        return DropdownButtonFormField<String>(
          key: const Key('agenda-owner-selector'),
          initialValue: _selectedOwnerUserId,
          isExpanded: true,
          decoration: const InputDecoration(
            isDense: true,
            labelText: 'Representante',
          ),
          hint: const Text('Selecione um representante'),
          items: users
              .map(
                (user) => DropdownMenuItem(
                  value: user.id,
                  child: Text(
                    user.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(growable: false),
          onChanged: (ownerUserId) {
            if (ownerUserId == null) return;
            setState(() => _selectedOwnerUserId = ownerUserId);
          },
        );
      },
    );
  }

  void _setSearch(String value) => setState(() => _search = value.trim());

  List<CalendarOccurrence> _filtered(List<CalendarOccurrence> occurrences) {
    final query = _search.toLowerCase();
    return occurrences
        .where((occurrence) {
          final matchesSearch =
              query.isEmpty ||
              occurrence.title.toLowerCase().contains(query) ||
              (occurrence.facility?.name.toLowerCase().contains(query) ??
                  false);
          final matchesStatus =
              _selectedStatus == null ||
              occurrence.interaction?.status == _selectedStatus;
          final matchesModality =
              _selectedModality == null ||
              occurrence.modality == _selectedModality;
          return matchesSearch && matchesStatus && matchesModality;
        })
        .toList(growable: false);
  }

  void _previousPeriod() => setState(
    () => _periodStart = _periodStart.subtract(const Duration(days: 7)),
  );

  void _nextPeriod() =>
      setState(() => _periodStart = _periodStart.add(const Duration(days: 7)));

  void _today() => setState(() => _periodStart = _startOfWeek(DateTime.now()));

  Future<void> _editOccurrence(CalendarOccurrence occurrence) async {
    if (!occurrence.recurrenceProvided) {
      await context.push(
        '/agenda/${occurrence.calendarId}/occurrences/${Uri.encodeComponent(occurrence.recurrenceKey)}/edit',
        extra: occurrence,
      );
      if (mounted) _refresh();
      return;
    }
    if (occurrence.recurrence == CalendarRecurrence.none) {
      await context.push(
        '/agenda/${occurrence.calendarId}/edit',
        extra: occurrence,
      );
    } else {
      final choice = await showModalBottomSheet<CalendarEditorMode>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.event_rounded),
                title: const Text('Editar somente esta ocorrência'),
                onTap: () =>
                    Navigator.pop(context, CalendarEditorMode.occurrence),
              ),
              ListTile(
                leading: const Icon(Icons.event_repeat_rounded),
                title: const Text('Editar toda a série'),
                onTap: () => Navigator.pop(context, CalendarEditorMode.series),
              ),
            ],
          ),
        ),
      );
      if (!mounted || choice == null) return;
      if (choice == CalendarEditorMode.occurrence) {
        await context.push(
          '/agenda/${occurrence.calendarId}/occurrences/${Uri.encodeComponent(occurrence.recurrenceKey)}/edit',
          extra: occurrence,
        );
      } else {
        await context.push(
          '/agenda/${occurrence.calendarId}/edit',
          extra: occurrence,
        );
      }
    }
    if (mounted) _refresh();
  }

  void _refresh() => ref.invalidate(agendaProvider(_query));
}

class _AgendaScaffold extends StatelessWidget {
  const _AgendaScaffold({
    this.occurrences = const [],
    this.loading = false,
    this.errorMessage,
    this.onRetry,
    required this.periodStart,
    this.ownerPicker,
    this.onCreate,
    this.onPreviousPeriod,
    this.onNextPeriod,
    this.onToday,
    this.onRefresh,
    this.onSearchChanged,
    this.onOccurrenceTap,
  });

  final List<CalendarOccurrence> occurrences;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final DateTime periodStart;
  final Widget? ownerPicker;
  final VoidCallback? onCreate;
  final VoidCallback? onPreviousPeriod;
  final VoidCallback? onNextPeriod;
  final VoidCallback? onToday;
  final VoidCallback? onRefresh;
  final ValueChanged<String>? onSearchChanged;
  final ValueChanged<CalendarOccurrence>? onOccurrenceTap;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Agenda'),
      body: Column(
        children: [
          _AgendaToolbar(
            periodStart: periodStart,
            ownerPicker: ownerPicker,
            onCreate: onCreate,
            onPreviousPeriod: onPreviousPeriod,
            onNextPeriod: onNextPeriod,
            onToday: onToday,
            onRefresh: onRefresh,
            onSearchChanged: onSearchChanged,
          ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (loading) return const _AgendaLoading();
    if (errorMessage != null) {
      return _AgendaError(message: errorMessage!, onRetry: onRetry);
    }
    if (occurrences.isEmpty) return const _AgendaEmpty();
    final groups = groupCalendarOccurrences(occurrences);
    return RefreshIndicator(
      onRefresh: () async => onRefresh?.call(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: groups.length,
        itemBuilder: (_, index) => AgendaDaySection(
          group: groups[index],
          onOccurrenceTap: onOccurrenceTap,
        ),
      ),
    );
  }
}

class _AgendaToolbar extends StatelessWidget {
  const _AgendaToolbar({
    required this.periodStart,
    this.ownerPicker,
    this.onCreate,
    this.onPreviousPeriod,
    this.onNextPeriod,
    this.onToday,
    this.onRefresh,
    this.onSearchChanged,
  });

  final DateTime periodStart;
  final Widget? ownerPicker;
  final VoidCallback? onCreate;
  final VoidCallback? onPreviousPeriod;
  final VoidCallback? onNextPeriod;
  final VoidCallback? onToday;
  final VoidCallback? onRefresh;
  final ValueChanged<String>? onSearchChanged;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(bottom: BorderSide(color: AppColors.gray200)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact =
                constraints.maxWidth < 420 ||
                MediaQuery.textScalerOf(context).scale(14) > 21;
            final navigation = Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 2,
              runSpacing: 4,
              children: [
                IconButton(
                  tooltip: 'Período anterior',
                  onPressed: onPreviousPeriod,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                IconButton(
                  tooltip: 'Próximo período',
                  onPressed: onNextPeriod,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
                TextButton(onPressed: onToday, child: const Text('Hoje')),
                IconButton(
                  tooltip: 'Atualizar agenda',
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
                if (onCreate != null)
                  IconButton(
                    tooltip: 'Criar compromisso',
                    onPressed: onCreate,
                    icon: const Icon(Icons.add_rounded),
                  ),
              ],
            );
            return ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: compact ? 280 : double.infinity,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (ownerPicker != null) ...[
                      DefaultTextStyle.merge(
                        overflow: TextOverflow.ellipsis,
                        maxLines: compact ? 2 : 1,
                        child: ownerPicker!,
                      ),
                      const SizedBox(height: 10),
                    ],
                    if (compact) ...[
                      Text(
                        _periodLabel(periodStart),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray800,
                        ),
                      ),
                      navigation,
                    ] else
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _periodLabel(periodStart),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.gray800,
                              ),
                            ),
                          ),
                          navigation,
                        ],
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('agenda-search'),
                      onChanged: onSearchChanged,
                      decoration: const InputDecoration(
                        isDense: true,
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Buscar por compromisso ou clínica',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AgendaLoading extends StatelessWidget {
  const _AgendaLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const Key('agenda-loading'),
      padding: const EdgeInsets.fromLTRB(84, 24, 16, 24),
      children: List.generate(
        5,
        (index) => Container(
          height: 58,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: index.isEven
                ? AppColors.gray100
                : AppColors.surfaceSecondary,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}

class _AgendaEmpty extends StatelessWidget {
  const _AgendaEmpty();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(32),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.event_available_outlined,
              size: 42,
              color: AppColors.gray500,
            ),
            SizedBox(height: 14),
            Text(
              'Nenhum compromisso neste período',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Use a agenda para acompanhar interações e bloqueios pessoais.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.gray600),
            ),
          ],
        ),
      ),
    );
  }
}

class _AgendaError extends StatelessWidget {
  const _AgendaError({required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_outlined,
              size: 42,
              color: AppColors.redDark,
            ),
            const SizedBox(height: 14),
            const Text(
              'Falha ao carregar a agenda',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.gray600),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AgendaPreview {
  const _AgendaPreview.content({
    required this.occurrences,
    required this.onPreviousPeriod,
    required this.onNextPeriod,
    required this.onToday,
    required this.onRefresh,
    this.now,
  }) : loading = false,
       errorMessage = null,
       onRetry = null;

  const _AgendaPreview.loading()
    : occurrences = const [],
      loading = true,
      errorMessage = null,
      onRetry = null,
      onPreviousPeriod = null,
      onNextPeriod = null,
      onToday = null,
      onRefresh = null,
      now = null;

  const _AgendaPreview.error({
    required this.errorMessage,
    required this.onRetry,
  }) : occurrences = const [],
       loading = false,
       onPreviousPeriod = null,
       onNextPeriod = null,
       onToday = null,
       onRefresh = null,
       now = null;

  final List<CalendarOccurrence> occurrences;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final VoidCallback? onPreviousPeriod;
  final VoidCallback? onNextPeriod;
  final VoidCallback? onToday;
  final VoidCallback? onRefresh;
  final DateTime? now;
}

DateTime _startOfWeek(DateTime value) {
  final date = DateTime(value.year, value.month, value.day);
  return date.subtract(Duration(days: date.weekday - DateTime.monday));
}

String _periodLabel(DateTime start) {
  final end = start.add(const Duration(days: 6));
  String compact(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}';
  return '${compact(start)} a ${compact(end)}';
}

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/widgets/agenda_day_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

  @override
  void initState() {
    super.initState();
    _periodStart = _startOfWeek(DateTime.now());
  }

  AgendaQuery get _query => AgendaQuery(
    from: _periodStart,
    to: _periodStart.add(const Duration(days: 7)),
  );

  @override
  Widget build(BuildContext context) {
    final preview = widget._preview;
    if (preview != null) {
      return _AgendaScaffold(
        occurrences: preview.occurrences,
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
      );
    }

    final agenda = ref.watch(agendaProvider(_query));
    return agenda.when(
      loading: () => _AgendaScaffold(
        loading: true,
        periodStart: _periodStart,
        ownerPicker: widget.ownerPicker,
        onCreate: widget.onCreate,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
      ),
      error: (error, _) => _AgendaScaffold(
        errorMessage: error.toString(),
        onRetry: _refresh,
        periodStart: _periodStart,
        ownerPicker: widget.ownerPicker,
        onCreate: widget.onCreate,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
      ),
      data: (occurrences) => _AgendaScaffold(
        occurrences: occurrences,
        periodStart: _periodStart,
        ownerPicker: widget.ownerPicker,
        onCreate: widget.onCreate,
        onPreviousPeriod: _previousPeriod,
        onNextPeriod: _nextPeriod,
        onToday: _today,
        onRefresh: _refresh,
      ),
    );
  }

  void _previousPeriod() => setState(
    () => _periodStart = _periodStart.subtract(const Duration(days: 7)),
  );

  void _nextPeriod() =>
      setState(() => _periodStart = _periodStart.add(const Duration(days: 7)));

  void _today() => setState(() => _periodStart = _startOfWeek(DateTime.now()));

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
        itemBuilder: (_, index) => AgendaDaySection(group: groups[index]),
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
  });

  final DateTime periodStart;
  final Widget? ownerPicker;
  final VoidCallback? onCreate;
  final VoidCallback? onPreviousPeriod;
  final VoidCallback? onNextPeriod;
  final VoidCallback? onToday;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(bottom: BorderSide(color: AppColors.gray200)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (ownerPicker != null) ...[
              ownerPicker!,
              const SizedBox(height: 10),
            ],
            Row(
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
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    _periodLabel(periodStart),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray800,
                    ),
                  ),
                ),
                TextButton(onPressed: onToday, child: const Text('Hoje')),
                IconButton(
                  tooltip: 'Atualizar agenda',
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  tooltip: onCreate == null
                      ? 'Criação de compromissos disponível em breve'
                      : 'Criar compromisso',
                  onPressed: onCreate,
                  icon: const Icon(Icons.add_rounded),
                ),
              ],
            ),
          ],
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
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
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
              'Use a agenda para acompanhar visitas, contatos e bloqueios pessoais.',
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

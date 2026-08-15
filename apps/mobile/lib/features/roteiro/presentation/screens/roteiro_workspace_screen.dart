import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/providers/roteiro_workspace_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/screens/roteiro_day_map_screen.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/providers/roteiro_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/rejection_reason_sheet.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/add_clinic_sheet.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/roteiro_slot_list.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/roteiro_timeline.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _monthNames = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

enum _View { sugestoes, dia }

/// Where a rep plans a day.
///
/// Not a list with a Confirm button. Planning is a loop — generate, look, drop
/// one, regenerate, look again — and the screen has to support the loop rather
/// than the last step of it. Nothing exists until **Salvar**, so a rep can churn
/// a draft as long as they like and walk away from it costing nothing.
class RoteiroWorkspaceScreen extends ConsumerStatefulWidget {
  const RoteiroWorkspaceScreen({super.key, required this.day});

  final DateTime day;

  @override
  ConsumerState<RoteiroWorkspaceScreen> createState() =>
      _RoteiroWorkspaceScreenState();
}

class _RoteiroWorkspaceScreenState
    extends ConsumerState<RoteiroWorkspaceScreen> {
  bool _requested = false;
  _View _view = _View.sugestoes;

  String get _scopeDate =>
      '${widget.day.year}-${widget.day.month.toString().padLeft(2, '0')}-${widget.day.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final verticalId = ref
        .watch(currentUserVerticalIdsProvider)
        .valueOrNull
        ?.firstOrNull;
    if (verticalId == null) {
      return _shell(
        context,
        const _Message(
          icon: Icons.category_outlined,
          title: 'Nenhuma linha ativa',
          body: 'Selecione uma linha comercial para montar o roteiro.',
        ),
        null,
      );
    }

    final key = RoteiroWorkspaceKey(
      verticalId: verticalId,
      scopeDate: _scopeDate,
    );
    final state = ref.watch(roteiroWorkspaceProvider(key));
    final notifier = ref.read(roteiroWorkspaceProvider(key).notifier);

    if (!_requested) {
      _requested = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => notifier.generate());
    }

    return _shell(context, _body(state, notifier), state);
  }

  Widget _shell(
    BuildContext context,
    Widget body,
    RoteiroWorkspaceState? state,
  ) {
    final roteiro = state?.roteiro;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardBg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Montar roteiro',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            Text(
              '${widget.day.day} de ${_monthNames[widget.day.month - 1]}',
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          ],
        ),
        actions: [
          if (roteiro != null && roteiro.stops.isNotEmpty)
            IconButton(
              tooltip: 'Ver dia no mapa',
              icon: const Icon(Icons.map_outlined),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => RoteiroDayMapScreen(roteiro: roteiro),
                ),
              ),
            ),
        ],
      ),
      body: body,
      bottomNavigationBar:
          state == null || roteiro == null || roteiro.stops.isEmpty
          ? null
          : _SaveBar(state: state, onSave: () => _save(state)),
    );
  }

  /// Removes a stop, then records why — in that order.
  ///
  /// The card leaves the screen the instant the rep taps. The rejection is
  /// written behind it, and the rep is only asked for a reason the second time
  /// they turn the same clinic down: the first removal means "not today" as
  /// often as "not here", and a sheet on every tap becomes something to
  /// dismiss rather than answer.
  Future<void> _remove(
    RoteiroStop stop,
    RoteiroWorkspaceNotifier notifier,
  ) async {
    notifier.remove(stop.facilityVerticalProfileId);

    final rejection = await notifier.recordRejection(
      stop.facilityVerticalProfileId,
    );
    if (rejection == null || !rejection.shouldAskReason) return;
    if (!mounted) return;

    final reason = await showRejectionReasonSheet(
      context,
      facilityName: stop.facilityName,
    );
    if (reason == null) return;
    await notifier.explainRejection(rejection.id, reason);
  }

  Future<void> _add(
    RoteiroWorkspaceState state,
    RoteiroWorkspaceNotifier notifier,
  ) async {
    final verticalId = ref
        .read(currentUserVerticalIdsProvider)
        .valueOrNull
        ?.firstOrNull;
    if (verticalId == null) return;
    final chosen = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (_) => AddClinicSheet(
        repository: ref.read(roteiroRepositoryProvider),
        verticalId: verticalId,
        alreadyInSlate: {
          for (final stop in state.roteiro?.stops ?? const [])
            stop.facilityVerticalProfileId,
        },
      ),
    );
    if (chosen != null) await notifier.add(chosen);
  }

  Future<void> _save(RoteiroWorkspaceState state) async {
    final verticalId = ref
        .read(currentUserVerticalIdsProvider)
        .valueOrNull
        ?.firstOrNull;
    if (verticalId == null) return;
    final key = RoteiroWorkspaceKey(
      verticalId: verticalId,
      scopeDate: _scopeDate,
    );
    final messenger = ScaffoldMessenger.of(context);
    final ok = await ref.read(roteiroWorkspaceProvider(key).notifier).save();
    if (!mounted) return;
    final error = ref.read(roteiroWorkspaceProvider(key)).error;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Roteiro salvo — sua agenda foi montada.'
              : (error?.toString() ?? 'Não foi possível salvar o roteiro.'),
        ),
      ),
    );
    if (ok && mounted) Navigator.of(context).pop();
  }

  Widget _body(RoteiroWorkspaceState state, RoteiroWorkspaceNotifier notifier) {
    if (state.loading && state.roteiro == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.blocker != null) {
      return _Message(
        icon: Icons.my_location_outlined,
        title: 'Precisamos da sua localização',
        body:
            'O roteiro de hoje parte de onde você está agora. Autorize a localização para continuar.',
        action: FilledButton(
          onPressed: notifier.generate,
          child: const Text('Tentar novamente'),
        ),
      );
    }
    if (state.error != null && state.roteiro == null) {
      return _Message(
        icon: Icons.error_outline,
        title: 'Não foi possível montar o roteiro',
        body: state.error.toString(),
        action: FilledButton(
          onPressed: notifier.generate,
          child: const Text('Tentar novamente'),
        ),
      );
    }

    final roteiro = state.roteiro;
    if (roteiro == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _Toolbar(
              state: state,
              onRegenerate: notifier.generate,
              onReset: notifier.reset,
              onAdd: () => _add(state, notifier),
            ),
            if (roteiro.stops.isNotEmpty && roteiro.fixedPoints.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: SegmentedButton<_View>(
                  segments: const [
                    ButtonSegment(
                      value: _View.sugestoes,
                      label: Text('Sugestões'),
                    ),
                    ButtonSegment(value: _View.dia, label: Text('Meu dia')),
                  ],
                  selected: {_view},
                  onSelectionChanged: (v) => setState(() => _view = v.first),
                ),
              ),
            ...roteiro.notices.map((n) => _Notice(notice: n)),
            if (roteiro.stops.isEmpty)
              const _Message(
                icon: Icons.explore_off_outlined,
                title: 'Nenhuma clínica elegível',
                body: 'Nada ao alcance para este dia nesta linha.',
              )
            else if (_view == _View.dia && roteiro.fixedPoints.isNotEmpty)
              RoteiroTimeline(roteiro: roteiro)
            else
              RoteiroSlotList(
                roteiro: roteiro,
                schedule: notifier.scheduleFor(roteiro),
                slotCount: roteiro.slotCount,
                onRemove: (stop) => _remove(stop, notifier),
                onFillEmpty: () => _add(state, notifier),
                onDurationChanged: (stop, minutes) => notifier.setDuration(
                  stop.facilityVerticalProfileId,
                  minutes,
                ),
                onTimeChanged: (stop, startsAt) => notifier.setStartTime(
                  stop.facilityVerticalProfileId,
                  startsAt,
                ),
              ),
          ],
        ),
        // A regeneration keeps the old slate visible underneath rather than
        // blanking the screen: the rep is comparing before and after, and an
        // empty screen between the two destroys the comparison.
        if (state.loading)
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(minHeight: 2),
          ),
      ],
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.state,
    required this.onRegenerate,
    required this.onReset,
    required this.onAdd,
  });

  final RoteiroWorkspaceState state;
  final VoidCallback onRegenerate;
  final VoidCallback onReset;
  final VoidCallback onAdd;

  /// Counts only the kinds of edit the rep actually made.
  ///
  /// Listing every kind means a rep who only stretched one visit is told
  /// "0 removidas", which is both noise and slightly wrong — it describes the
  /// edit they did not make.
  static String _editSummary(RoteiroWorkspaceState state) {
    final parts = <String>[
      if (state.excluded.isNotEmpty)
        '${state.excluded.length} removida${state.excluded.length == 1 ? "" : "s"}',
      if (state.included.isNotEmpty)
        '${state.included.length} adicionada${state.included.length == 1 ? "" : "s"}',
      if (state.durations.isNotEmpty || state.startTimes.isNotEmpty)
        'horários ajustados',
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (state.dirty)
            Expanded(
              child: Text(
                _editSummary(state),
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            )
          else
            const Expanded(
              child: Text(
                'Ajuste horário e duração; o dia se reorganiza',
                style: TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            ),
          if (state.dirty)
            TextButton(onPressed: onReset, child: const Text('Recomeçar')),
          IconButton(
            tooltip: 'Adicionar clínica',
            onPressed: onAdd,
            icon: const Icon(Icons.add_circle_outline, size: 20),
          ),
          IconButton(
            tooltip: 'Gerar de novo',
            onPressed: onRegenerate,
            icon: const Icon(Icons.refresh, size: 20),
          ),
        ],
      ),
    );
  }
}

class _SaveBar extends StatelessWidget {
  const _SaveBar({required this.state, required this.onSave});

  final RoteiroWorkspaceState state;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final roteiro = state.roteiro!;
    final drive = (roteiro.driveSeconds / 60).round();
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: AppColors.cardBg,
          border: Border(top: BorderSide(color: AppColors.gray200)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${roteiro.stops.length} '
                '${roteiro.stops.length == 1 ? "parada" : "paradas"} · $drive min',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
            FilledButton(
              onPressed: state.saving ? null : onSave,
              child: state.saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Salvar na agenda'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.notice});

  final RoteiroNotice notice;

  @override
  Widget build(BuildContext context) {
    final blocking = notice.isBlocking;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: blocking ? AppColors.red50 : AppColors.amber50,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            blocking ? Icons.error_outline : Icons.info_outline,
            size: 16,
            color: blocking ? AppColors.redDark : AppColors.amberDark,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              notice.message,
              style: TextStyle(
                fontSize: 12,
                color: blocking ? AppColors.redDark : AppColors.amberDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(24, 64, 24, 24),
    children: [
      Icon(icon, size: 44, color: AppColors.gray400),
      const SizedBox(height: 14),
      Text(
        title,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.gray900,
        ),
      ),
      const SizedBox(height: 6),
      Text(
        body,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13, color: AppColors.gray600),
      ),
      if (action != null) ...[
        const SizedBox(height: 18),
        Center(child: action!),
      ],
    ],
  );
}

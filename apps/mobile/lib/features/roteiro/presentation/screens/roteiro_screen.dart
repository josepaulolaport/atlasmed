import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/providers/roteiro_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/roteiro_stop_card.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/widgets/roteiro_timeline.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Roteiro do dia — spec 0016 P1.
///
/// The list only: no map, no route line, no confirm. Travel times are
/// straight-line estimates and every one says so. That is deliberate — a ranked,
/// explained list of five clinics is already the thing that does not exist
/// today, and it can be judged before any of the routing is built.
class RoteiroScreen extends ConsumerStatefulWidget {
  const RoteiroScreen({super.key});

  @override
  ConsumerState<RoteiroScreen> createState() => _RoteiroScreenState();
}

/// Two readings of the same slate.
///
/// `lista` answers "why these clinics"; `dia` answers "does this day work". A
/// rep with commitments needs the second, because suggestions alone give no
/// sense of the day they slot into.
enum _View { lista, dia }

class _RoteiroScreenState extends ConsumerState<RoteiroScreen> {
  bool _requested = false;
  _View _view = _View.lista;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(roteiroProvider);
    final verticalId = ref
        .watch(currentUserVerticalIdsProvider)
        .valueOrNull
        ?.firstOrNull;

    // A rep's linha comes from their session; there is nothing to choose while
    // only one vertical is live.
    if (!_requested &&
        verticalId != null &&
        !state.loading &&
        state.roteiro == null) {
      _requested = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(roteiroProvider.notifier).generate(verticalId: verticalId);
      });
    }

    final roteiro = state.roteiro;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Roteiro do dia')),
      body: RefreshIndicator(
        onRefresh: () async {
          if (verticalId == null) return;
          await ref
              .read(roteiroProvider.notifier)
              .generate(verticalId: verticalId);
        },
        child: _body(context, state, verticalId),
      ),
      bottomNavigationBar: roteiro == null || roteiro.stops.isEmpty
          ? null
          : _ConfirmBar(
              roteiro: roteiro,
              confirming: state.confirming,
              onConfirm: () => _confirm(context),
            ),
    );
  }

  Future<void> _confirm(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await ref.read(roteiroProvider.notifier).confirm();
    if (!context.mounted) return;
    final error = ref.read(roteiroProvider).error;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Roteiro confirmado — sua agenda foi montada.'
              : (error?.toString() ?? 'Não foi possível confirmar o roteiro.'),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, RoteiroState state, int? verticalId) {
    if (verticalId == null) {
      return const _Message(
        icon: Icons.category_outlined,
        title: 'Nenhuma linha ativa',
        body: 'Selecione uma linha comercial para gerar o roteiro.',
      );
    }
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.blocker != null) {
      return _BlockerView(
        blocker: state.blocker!,
        onRetry: () =>
            ref.read(roteiroProvider.notifier).generate(verticalId: verticalId),
      );
    }
    if (state.error != null) {
      return _Message(
        icon: Icons.error_outline,
        title: 'Não foi possível gerar o roteiro',
        body: state.error.toString(),
        action: FilledButton(
          onPressed: () => ref
              .read(roteiroProvider.notifier)
              .generate(verticalId: verticalId),
          child: const Text('Tentar novamente'),
        ),
      );
    }

    final roteiro = state.roteiro;
    if (roteiro == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        if (roteiro.stops.isNotEmpty) _Summary(roteiro: roteiro),
        // Offered only when there is something to interleave with. On a clear
        // day the timeline shows the same thing as the list, and a toggle that
        // changes nothing is noise.
        if (roteiro.stops.isNotEmpty && roteiro.fixedPoints.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: SegmentedButton<_View>(
              segments: const [
                ButtonSegment(value: _View.lista, label: Text('Sugestões')),
                ButtonSegment(value: _View.dia, label: Text('Meu dia')),
              ],
              selected: {_view},
              onSelectionChanged: (v) => setState(() => _view = v.first),
            ),
          ),
        // Notices are rendered, never swallowed (§4.8). A slate missing its
        // prospecting stop must not look like one where prospecting was
        // impossible.
        ...roteiro.notices.map((n) => _NoticeBanner(notice: n)),
        if (roteiro.stops.isEmpty)
          const _Message(
            icon: Icons.explore_off_outlined,
            title: 'Nenhuma clínica elegível hoje',
            body:
                'Nada ao alcance da sua posição atual nesta linha. Puxe para atualizar.',
          )
        else if (_view == _View.dia && roteiro.fixedPoints.isNotEmpty)
          RoteiroTimeline(roteiro: roteiro)
        else
          ...roteiro.stops.map(
            (stop) => RoteiroStopCard(
              stop: stop,
              estimatedTravel: roteiro.isEstimated,
            ),
          ),
      ],
    );
  }
}

/// Sticky footer: the day's totals and the one action that matters.
class _ConfirmBar extends StatelessWidget {
  const _ConfirmBar({
    required this.roteiro,
    required this.confirming,
    required this.onConfirm,
  });

  final Roteiro roteiro;
  final bool confirming;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final drive = (roteiro.driveSeconds / 60).round();
    final ends = roteiro.endsAt;
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${roteiro.stops.length} '
                    '${roteiro.stops.length == 1 ? "parada" : "paradas"} · $drive min',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                    ),
                  ),
                  if (ends != null)
                    Text(
                      'termina ${ends.hour.toString().padLeft(2, '0')}:${ends.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray500,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (roteiro.isConfirmed)
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, size: 18, color: AppColors.green),
                  SizedBox(width: 6),
                  Text(
                    'Na agenda',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.green,
                    ),
                  ),
                ],
              )
            else
              FilledButton(
                onPressed: confirming || !roteiro.canConfirm ? null : onConfirm,
                child: confirming
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Confirmar roteiro'),
              ),
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.roteiro});

  final Roteiro roteiro;

  @override
  Widget build(BuildContext context) {
    final drive = (roteiro.driveSeconds / 60).round();
    final ends = roteiro.endsAt;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.blueLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${roteiro.stops.length} '
            '${roteiro.stops.length == 1 ? "parada" : "paradas"} · '
            '$drive min de deslocamento'
            '${ends != null ? " · termina ${ends.hour.toString().padLeft(2, '0')}:${ends.minute.toString().padLeft(2, '0')}" : ""}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          if (roteiro.isEstimated) ...[
            const SizedBox(height: 6),
            const Text(
              'Tempos estimados em linha reta — ainda sem rota real.',
              style: TextStyle(fontSize: 12, color: AppColors.gray600),
            ),
          ],
          if (roteiro.isAnchored) ...[
            const SizedBox(height: 4),
            const Text(
              'Planejado ao redor de uma visita já combinada.',
              style: TextStyle(fontSize: 12, color: AppColors.gray600),
            ),
          ],
        ],
      ),
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  const _NoticeBanner({required this.notice});

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

class _BlockerView extends StatelessWidget {
  const _BlockerView({required this.blocker, required this.onRetry});

  final RoteiroBlocker blocker;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // Location has no fallback by design (§4.1): the app asks rather than
    // planning a day from a position the rep is not at.
    final (title, body) = switch (blocker) {
      RoteiroBlocker.locationOff => (
        'Localização desligada',
        'Ligue a localização do aparelho para o roteiro saber de onde você parte.',
      ),
      RoteiroBlocker.locationDeniedForever => (
        'Permissão de localização negada',
        'Autorize a localização nas configurações do aparelho para gerar o roteiro.',
      ),
      RoteiroBlocker.locationDenied => (
        'Precisamos da sua localização',
        'O roteiro parte de onde você está agora. Sem isso não há como sugerir o que dá para fazer hoje.',
      ),
      RoteiroBlocker.noVertical => (
        'Nenhuma linha ativa',
        'Selecione uma linha comercial para gerar o roteiro.',
      ),
    };
    return _Message(
      icon: Icons.my_location_outlined,
      title: title,
      body: body,
      action: FilledButton(
        onPressed: onRetry,
        child: const Text('Tentar novamente'),
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

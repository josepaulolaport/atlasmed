import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/subscreen_app_bar.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Detail for one field-change suggestion.
///
/// [canReview] enables Aceitar/Rejeitar (ops queue). Establishment screens
/// open this with `canReview: false` for view-only.
class NaoConformidadeDetailScreen extends ConsumerWidget {
  const NaoConformidadeDetailScreen({
    super.key,
    required this.suggestionId,
    this.canReview = true,
  });

  final int suggestionId;

  /// When false, pending suggestions are view-only (no decision bar).
  final bool canReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSuggestion = ref.watch(
      naoConformidadeByIdProvider(suggestionId),
    );
    final user = ref.watch(currentUserProvider).valueOrNull;
    final roleCanReview = ref.watch(canReviewFieldSuggestionsProvider);
    final effectiveCanReview = canReview && roleCanReview;

    return asyncSuggestion.when(
      loading: () => Scaffold(
        appBar: const SubscreenAppBar(title: 'Não conformidade'),
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.navyBright),
                ),
              ),
            ],
          ),
        ),
      ),
      // A request that failed is not a suggestion that does not exist. This
      // rendered "Sugestão não encontrada" for a dropped connection, which
      // sends the reviewer looking for the wrong problem.
      error: (_, _) => _DetailMessage(
        message: 'Não foi possível carregar esta sugestão.',
        onBack: () => context.pop(),
      ),
      data: (suggestion) {
        final owned =
            suggestion?.isOwnedBy(
              userId: user?.id,
              displayName: user?.displayName,
            ) ??
            false;

        if (suggestion == null || (!effectiveCanReview && !owned)) {
          return _NotFound(onBack: () => context.pop());
        }

        return _DetailBody(
          suggestion: suggestion,
          canReview: effectiveCanReview,
        );
      },
    );
  }
}

class _NotFound extends StatelessWidget {
  const _NotFound({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) =>
      _DetailMessage(message: 'Sugestão não encontrada', onBack: onBack);
}

/// The whole screen reduced to one sentence and a way back.
class _DetailMessage extends StatelessWidget {
  const _DetailMessage({required this.message, required this.onBack});

  final String message;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const SubscreenAppBar(title: 'Não conformidade'),
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.gray500),
                  ),
                ),
              ),
            ),
            TextButton(onPressed: onBack, child: const Text('Voltar')),
          ],
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.suggestion, required this.canReview});

  final NaoConformidadeSuggestion suggestion;
  final bool canReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = suggestion.status;
    final showDecisionBar = canReview && suggestion.isPending;

    return Scaffold(
      appBar: const SubscreenAppBar(title: 'Não conformidade'),
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back_rounded, size: 18),
                      label: Text(canReview ? 'Fila' : 'Voltar'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.navyBright,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          suggestion.detailTitle,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navyDeep,
                          ),
                        ),
                      ),
                      _StatusPill(status: status),
                    ],
                  ),
                  if (!suggestion.isDeactivation) ...[
                    const SizedBox(height: 8),
                    _FieldChip(label: suggestion.fieldLabel),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    'Enviado por ${suggestion.submittedByName} '
                    '(${suggestion.submittedByRole.label}) · '
                    '${_formatDateTime(suggestion.submittedAt)}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.gray500,
                    ),
                  ),
                  if (suggestion.reviewedAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${status == NaoConformidadeStatus.accepted ? 'Aceita' : 'Rejeitada'}'
                      ' por ${suggestion.reviewedByName ?? '—'} · '
                      '${_formatDateTime(suggestion.reviewedAt!)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                  if (!canReview && suggestion.isPending) ...[
                    const SizedBox(height: 12),
                    const _AwaitingReviewBanner(),
                  ],
                  const SizedBox(height: 18),
                  const _SectionLabel('ALVO'),
                  const SizedBox(height: 8),
                  _TargetCard(suggestion: suggestion),
                  if (status == NaoConformidadeStatus.rejected &&
                      suggestion.reviewerNote != null) ...[
                    const SizedBox(height: 14),
                    _RejectNoteBanner(note: suggestion.reviewerNote!),
                  ],
                  const SizedBox(height: 18),
                  _SectionLabel(
                    suggestion.isDeactivation
                        ? 'SOLICITAÇÃO DE DESATIVAÇÃO'
                        : 'ALTERAÇÃO DO CAMPO',
                  ),
                  const SizedBox(height: 8),
                  _DiffCard(suggestion: suggestion),
                  if (suggestion.reason != null &&
                      suggestion.reason!.trim().isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const _SectionLabel('MOTIVO INFORMADO'),
                    const SizedBox(height: 8),
                    _ReasonCard(reason: suggestion.reason!),
                  ],
                ],
              ),
            ),
            if (showDecisionBar)
              _DecisionBar(
                onAccept: () => _accept(context, ref, suggestion),
                onReject: () => _showRejectDialog(context, ref, suggestion),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _accept(
    BuildContext context,
    WidgetRef ref,
    NaoConformidadeSuggestion suggestion,
  ) async {
    try {
      await ref.read(naoConformidadeActionsProvider).accept(suggestion.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sugestão aceita'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      // The exception was interpolated into this line. It names Dart types,
      // not anything the reviewer can act on.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível aceitar. Tente de novo.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _showRejectDialog(
    BuildContext context,
    WidgetRef ref,
    NaoConformidadeSuggestion suggestion,
  ) async {
    // Dialog owns the TextEditingController — disposing it here while the
    // route is still animating out leaves EditableText dependents attached
    // and trips `_dependents.isEmpty` in framework.dart.
    final note = await showDialog<String>(
      context: context,
      builder: (ctx) => const _RejectSuggestionDialog(),
    );
    if (note == null || note.isEmpty || !context.mounted) return;

    try {
      await ref
          .read(naoConformidadeActionsProvider)
          .reject(suggestion.id, note: note);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sugestão rejeitada'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível rejeitar. Tente de novo.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _formatDateTime(DateTime at) {
    final d = at.day.toString().padLeft(2, '0');
    final m = at.month.toString().padLeft(2, '0');
    final h = at.hour.toString().padLeft(2, '0');
    final min = at.minute.toString().padLeft(2, '0');
    return '$d/$m/${at.year} $h:$min';
  }
}

class _RejectSuggestionDialog extends StatefulWidget {
  const _RejectSuggestionDialog();

  @override
  State<_RejectSuggestionDialog> createState() =>
      _RejectSuggestionDialogState();
}

class _RejectSuggestionDialogState extends State<_RejectSuggestionDialog> {
  late final TextEditingController _controller = TextEditingController();

  /// The note is what the sender is told, so rejecting without one is not a
  /// thing this dialog can do. It used to pop `''` on an empty field, which
  /// the caller silently discarded — so the dialog closed exactly as if the
  /// rejection had been recorded, and nothing had happened.
  bool _canReject = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Rejeitar sugestão'),
      content: TextField(
        key: const Key('nc-reject-note'),
        controller: _controller,
        autofocus: true,
        maxLines: 3,
        onChanged: (value) {
          final can = value.trim().isNotEmpty;
          if (can != _canReject) setState(() => _canReject = can);
        },
        decoration: const InputDecoration(
          hintText: 'Motivo da rejeição',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('nc-reject-submit'),
          onPressed: _canReject
              ? () => Navigator.of(context).pop(_controller.text.trim())
              : null,
          child: const Text('Rejeitar'),
        ),
      ],
    );
  }
}

class _FieldChip extends StatelessWidget {
  const _FieldChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.blueLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.blueLight),
        ),
        child: Text(
          'Campo: $label',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.navyBright,
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final NaoConformidadeStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: status.color,
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: AppColors.gray400,
      ),
    );
  }
}

class _TargetCard extends StatelessWidget {
  const _TargetCard({required this.suggestion});

  final NaoConformidadeSuggestion suggestion;

  void _openClinic(BuildContext context) {
    if (suggestion.targetId <= 0) return;
    ClinicDetailRoute(id: suggestion.targetId).push(context);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => _openClinic(context),
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.blueLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  suggestion.targetType.icon,
                  size: 20,
                  color: AppColors.navyBright,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      suggestion.targetName,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      suggestion.contextSubtitle,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: AppColors.navyBright,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiffCard extends StatelessWidget {
  const _DiffCard({required this.suggestion});

  final NaoConformidadeSuggestion suggestion;

  @override
  Widget build(BuildContext context) {
    if (suggestion.isDeactivation) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.red50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.red100),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Campo afetado',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.fieldLabel,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Status atual',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.currentValue,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.gray600,
                decoration: TextDecoration.lineThrough,
                decorationColor: AppColors.error,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Status solicitado',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.suggestedValue,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.error,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Campo',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.fieldLabel,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.navyBright,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Valor atual',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.currentValue,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.gray600,
              decoration: TextDecoration.lineThrough,
              decorationColor: AppColors.error,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Valor sugerido',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.suggestedValue,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.green600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReasonCard extends StatelessWidget {
  const _ReasonCard({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Text(
        reason,
        style: const TextStyle(
          fontSize: 13.5,
          height: 1.4,
          color: AppColors.gray700,
        ),
      ),
    );
  }
}

class _AwaitingReviewBanner extends StatelessWidget {
  const _AwaitingReviewBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.amber50),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.hourglass_top_rounded, size: 18, color: AppColors.amber),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Aguardando análise. Aceite e rejeição ficam na fila de '
              'Não Conformidades.',
              style: TextStyle(fontSize: 12.5, color: AppColors.amber),
            ),
          ),
        ],
      ),
    );
  }
}

class _RejectNoteBanner extends StatelessWidget {
  const _RejectNoteBanner({required this.note});

  final String note;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.red100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Motivo da rejeição',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: AppColors.error,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            note,
            style: const TextStyle(fontSize: 13, color: Color(0xFF7f1d1d)),
          ),
        ],
      ),
    );
  }
}

/// Accept or reject, once.
///
/// Both stayed live for the duration of their request, so a second tap during
/// a slow accept posted a second decision on the same suggestion.
class _DecisionBar extends StatefulWidget {
  const _DecisionBar({required this.onAccept, required this.onReject});

  final Future<void> Function() onAccept;
  final Future<void> Function() onReject;

  @override
  State<_DecisionBar> createState() => _DecisionBarState();
}

class _DecisionBarState extends State<_DecisionBar> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              key: const Key('nc-decision-reject'),
              onPressed: _busy ? null : () => _run(widget.onReject),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.red100),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Rejeitar',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              key: const Key('nc-decision-accept'),
              onPressed: _busy ? null : () => _run(widget.onAccept),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.green600,
                disabledBackgroundColor: AppColors.gray200,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.gray500,
                      ),
                    )
                  : const Text(
                      'Aceitar',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

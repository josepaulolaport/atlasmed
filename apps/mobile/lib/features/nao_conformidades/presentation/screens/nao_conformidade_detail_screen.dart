import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

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

  final String suggestionId;

  /// When false, pending suggestions are view-only (no decision bar).
  final bool canReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncSuggestion = ref.watch(
      naoConformidadeByIdProvider(suggestionId),
    );
    final user = ref.watch(currentUserProvider).valueOrNull;

    return asyncSuggestion.when(
      loading: () => Scaffold(
        backgroundColor: const Color(0xFFf7f8fb),
        body: SafeArea(
          child: Column(
            children: [
              const AtlasTopBar(page: 'Não Conformidades', compact: true),
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFF1e40af)),
                ),
              ),
            ],
          ),
        ),
      ),
      error: (_, _) => _NotFound(onBack: () => context.pop()),
      data: (suggestion) {
        final owned =
            suggestion?.isOwnedBy(
              userId: user?.id,
              displayName: user?.displayName,
            ) ??
            false;

        if (suggestion == null || (!canReview && !owned)) {
          return _NotFound(onBack: () => context.pop());
        }

        return _DetailBody(
          suggestion: suggestion,
          canReview: canReview,
        );
      },
    );
  }
}

class _NotFound extends StatelessWidget {
  const _NotFound({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Não Conformidades', compact: true),
            const Expanded(
              child: Center(
                child: Text(
                  'Sugestão não encontrada',
                  style: TextStyle(color: Color(0xFF6b7280)),
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
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Não Conformidades', compact: true),
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
                        foregroundColor: const Color(0xFF1e40af),
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
                            color: Color(0xFF0a2f7f),
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
                      color: Color(0xFF6b7280),
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
                        color: Color(0xFF9ca3af),
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
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao aceitar: $e'),
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
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Rejeitar sugestão'),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Motivo da rejeição',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
              child: const Text('Rejeitar'),
            ),
          ],
        );
      },
    );
    controller.dispose();
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
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao rejeitar: $e'),
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
          color: const Color(0xFFeff6ff),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFbfdbfe)),
        ),
        child: Text(
          'Campo: $label',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1e40af),
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
        color: Color(0xFF9ca3af),
      ),
    );
  }
}

class _TargetCard extends StatelessWidget {
  const _TargetCard({required this.suggestion});

  final NaoConformidadeSuggestion suggestion;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFeff6ff),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              suggestion.targetType.icon,
              size: 20,
              color: const Color(0xFF1e40af),
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
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  suggestion.contextSubtitle,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF6b7280),
                  ),
                ),
              ],
            ),
          ),
        ],
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
          color: const Color(0xFFfef2f2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFfecaca)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Campo afetado',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.fieldLabel,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Status atual',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.currentValue,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF4b5563),
                decoration: TextDecoration.lineThrough,
                decorationColor: Color(0xFFdc2626),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Status solicitado',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              suggestion.suggestedValue,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFFdc2626),
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
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Campo',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.fieldLabel,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1e40af),
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Valor atual',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.currentValue,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF4b5563),
              decoration: TextDecoration.lineThrough,
              decorationColor: Color(0xFFdc2626),
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Valor sugerido',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            suggestion.suggestedValue,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF059669),
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
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Text(
        reason,
        style: const TextStyle(
          fontSize: 13.5,
          height: 1.4,
          color: Color(0xFF374151),
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
        color: const Color(0xFFfefce8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFfde68a)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.hourglass_top_rounded, size: 18, color: Color(0xFFa16207)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Aguardando análise. Aceite e rejeição ficam na fila de '
              'Não Conformidades.',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF854d0e)),
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
        color: const Color(0xFFfef2f2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFfecaca)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Motivo da rejeição',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFFdc2626),
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

class _DecisionBar extends StatelessWidget {
  const _DecisionBar({required this.onAccept, required this.onReject});

  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFeef0f3))),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFdc2626),
                side: const BorderSide(color: Color(0xFFfecaca)),
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
              onPressed: onAccept,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
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

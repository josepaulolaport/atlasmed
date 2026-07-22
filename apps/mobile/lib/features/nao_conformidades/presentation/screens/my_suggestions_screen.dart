import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/screens/nao_conformidade_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/widgets/suggestion_change_summary.dart';

/// Dedicated list of the current user’s clinic suggestions.
class MySuggestionsScreen extends ConsumerWidget {
  const MySuggestionsScreen.clinic({
    super.key,
    required this.targetId,
    required this.targetName,
  });

  final String targetId;
  final String targetName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncItems = ref.watch(mySuggestionsForClinicProvider(targetId));

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const Color(0xFF0f1729),
        title: Text(
          asyncItems.maybeWhen(
            data: (items) => 'Não Conformidades · ${items.length}',
            orElse: () => 'Não Conformidades',
          ),
        ),
      ),
      body: asyncItems.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFF1e40af)),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Não foi possível carregar suas sugestões',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(mySuggestionsForClinicProvider(targetId)),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1e40af),
                  ),
                  child: const Text('Tentar novamente'),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          final pending = items
              .where((e) => e.status == NaoConformidadeStatus.pending)
              .length;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text(
                targetName,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0a2f7f),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                pending == 0
                    ? 'Nenhuma sugestão aguardando análise'
                    : '$pending aguardando análise',
                style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
              ),
              const SizedBox(height: 16),
              if (items.isEmpty)
                const _EmptyCard()
              else
                for (final (i, item) in items.indexed) ...[
                  if (i > 0) const SizedBox(height: 8),
                  _SuggestionCard(
                    suggestion: item,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => NaoConformidadeDetailScreen(
                          suggestionId: item.id,
                          canReview: false,
                        ),
                      ),
                    ),
                  ),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: const Text(
        'Você ainda não enviou não conformidades para este perfil.',
        style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
      ),
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  const _SuggestionCard({required this.suggestion, required this.onTap});

  final NaoConformidadeSuggestion suggestion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = suggestion.status;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFeef0f3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: SuggestionChangeSummary(
                  suggestion: suggestion,
                  compact: true,
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: status.backgroundColor,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status.label,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: status.color,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: Color(0xFF9ca3af),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

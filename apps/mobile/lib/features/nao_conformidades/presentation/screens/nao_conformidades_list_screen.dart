import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/widgets/suggestion_change_summary.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

/// Ops queue: field-change suggestions from reps/managers + accepted history.
class NaoConformidadesListScreen extends ConsumerStatefulWidget {
  const NaoConformidadesListScreen({super.key});

  @override
  ConsumerState<NaoConformidadesListScreen> createState() =>
      _NaoConformidadesListScreenState();
}

class _NaoConformidadesListScreenState
    extends ConsumerState<NaoConformidadesListScreen> {
  String _filter = 'Pendentes';

  static const _filters = <String>[
    'Pendentes',
    'Aceitas',
    'Rejeitadas',
    'Todas',
  ];

  String get _apiStatus {
    switch (_filter) {
      case 'Aceitas':
        return 'APPROVED';
      case 'Rejeitadas':
        return 'REJECTED';
      case 'Todas':
        return 'ALL';
      case 'Pendentes':
      default:
        return 'PENDING';
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncQueue = ref.watch(opsNaoConformidadesProvider(_apiStatus));

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AtlasTopBar(page: 'Não Conformidades'),
            Expanded(
              child: asyncQueue.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: Color(0xFF1e40af)),
                ),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () =>
                      ref.invalidate(opsNaoConformidadesProvider(_apiStatus)),
                ),
                data: (queue) {
                  final pendingCount = _filter == 'Pendentes'
                      ? queue.length
                      : queue
                            .where(
                              (e) => e.status == NaoConformidadeStatus.pending,
                            )
                            .length;

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      const Text(
                        'Não Conformidades',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0a2f7f),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        pendingCount == 0
                            ? 'Nenhuma sugestão aguardando análise'
                            : '$pendingCount aguardando análise',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _filters.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final label = _filters[i];
                            final selected = label == _filter;
                            return _FilterChip(
                              label: label,
                              selected: selected,
                              onTap: () => setState(() => _filter = label),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (queue.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 48),
                          child: Center(
                            child: Text(
                              'Nenhuma sugestão neste filtro',
                              style: TextStyle(
                                fontSize: 13.5,
                                color: Color(0xFF9ca3af),
                              ),
                            ),
                          ),
                        )
                      else
                        for (final (i, item) in queue.indexed) ...[
                          if (i > 0) const SizedBox(height: 10),
                          _SuggestionListCard(
                            suggestion: item,
                            onTap: () =>
                                context.push('/nao-conformidades/${item.id}'),
                          ),
                        ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Não foi possível carregar as sugestões',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF1e40af),
              ),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFF1e40af) : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? const Color(0xFF1e40af)
                  : const Color(0xFFe5e7eb),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF374151),
            ),
          ),
        ),
      ),
    );
  }
}

class _SuggestionListCard extends StatelessWidget {
  const _SuggestionListCard({required this.suggestion, required this.onTap});

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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      suggestion.targetName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 6),
                    SuggestionChangeSummary(
                      suggestion: suggestion,
                      compact: true,
                    ),
                  ],
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

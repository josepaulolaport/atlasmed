import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/providers/cadastro_review_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

/// Ops queue: documents submitted by reps awaiting approve/reject.
class CadastrosReviewListScreen extends ConsumerStatefulWidget {
  const CadastrosReviewListScreen({super.key});

  @override
  ConsumerState<CadastrosReviewListScreen> createState() =>
      _CadastrosReviewListScreenState();
}

class _CadastrosReviewListScreenState
    extends ConsumerState<CadastrosReviewListScreen> {
  static const _filters = <(String label, String apiStatus)>[
    ('Em análise', 'SUBMITTED'),
    ('Aprovados', 'VALIDATED'),
    ('Rejeitados', 'REJECTED'),
  ];

  @override
  Widget build(BuildContext context) {
    final apiStatus = ref.watch(cadastroReviewApiStatusProvider);
    final queueAsync = ref.watch(cadastroReviewQueueProvider);
    final selectedLabel = _filters
        .firstWhere((f) => f.$2 == apiStatus, orElse: () => _filters.first)
        .$1;

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AtlasTopBar(page: 'Cadastros'),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(cadastroReviewQueueProvider);
                  await ref.read(cadastroReviewQueueProvider.future);
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  children: [
                    const Text(
                      'Cadastros',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0a2f7f),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      queueAsync.when(
                        data: (queue) => queue.isEmpty
                            ? 'Nenhuma submissão neste filtro'
                            : '${queue.length} submissão${queue.length == 1 ? '' : 'ões'}',
                        loading: () => 'Carregando…',
                        error: (_, _) => 'Falha ao carregar a fila',
                      ),
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
                          final (label, status) = _filters[i];
                          final selected = label == selectedLabel;
                          return _FilterChip(
                            label: label,
                            selected: selected,
                            onTap: () {
                              ref
                                      .read(
                                        cadastroReviewApiStatusProvider
                                            .notifier,
                                      )
                                      .state =
                                  status;
                            },
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    ...queueAsync.when(
                      loading: () => [
                        const Padding(
                          padding: EdgeInsets.only(top: 48),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                      ],
                      error: (error, _) => [
                        Padding(
                          padding: const EdgeInsets.only(top: 48),
                          child: Column(
                            children: [
                              Text(
                                error.toString(),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Color(0xFF6b7280),
                                ),
                              ),
                              TextButton(
                                onPressed: () =>
                                    ref.invalidate(cadastroReviewQueueProvider),
                                child: const Text('Tentar novamente'),
                              ),
                            ],
                          ),
                        ),
                      ],
                      data: (queue) {
                        if (queue.isEmpty) {
                          return [
                            const Padding(
                              padding: EdgeInsets.only(top: 48),
                              child: Center(
                                child: Text(
                                  'Nenhum cadastro neste filtro',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    color: Color(0xFF9ca3af),
                                  ),
                                ),
                              ),
                            ),
                          ];
                        }
                        return [
                          for (final (i, item) in queue.indexed) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _ReviewListCard(
                              submission: item,
                              onTap: () =>
                                  context.push('/cadastros/${item.id}'),
                            ),
                          ],
                        ];
                      },
                    ),
                  ],
                ),
              ),
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
      color: selected ? const Color(0xFF0a2f7f) : Colors.white,
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
                  ? const Color(0xFF0a2f7f)
                  : const Color(0xFFe5e7eb),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF4b5563),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReviewListCard extends StatelessWidget {
  const _ReviewListCard({required this.submission, required this.onTap});

  final CadastroReviewSubmission submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = submission.status;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFeef0f3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: status.backgroundColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  submission.isPdf
                      ? Icons.picture_as_pdf_rounded
                      : Icons.image_outlined,
                  size: 22,
                  color: status.color,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      submission.facilityName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      submission.documentTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF4b5563),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Por ${submission.submittedByName} · '
                      '${_relative(submission.submittedAt)}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF9ca3af),
                      ),
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
                    size: 20,
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

  String _relative(DateTime at) {
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 60) return 'há ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'há ${diff.inHours} h';
    if (diff.inDays == 1) return 'ontem';
    return 'há ${diff.inDays} dias';
  }
}

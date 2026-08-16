import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/providers/cadastro_review_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

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

    // Was `'submissão' + 'ões'`, so anything above one read "2 submissãoões".
    // Null on an empty queue: the body's empty state says that, and the two
    // used to say it at once in different words.
    final countLabel = queueAsync.when(
      data: (queue) => queue.isEmpty
          ? null
          : '${queue.length} '
                '${queue.length == 1 ? 'submissão' : 'submissões'}',
      loading: () => 'Carregando…',
      error: (_, _) => 'Falha ao carregar a fila',
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Cadastros'),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
                        color: AppColors.navyDeep,
                      ),
                    ),
                    if (countLabel != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        countLabel,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.gray500,
                        ),
                      ),
                    ],
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
                      loading: () => const [
                        Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: ReviewListSkeleton(),
                        ),
                      ],
                      error: (_, _) => [
                        Padding(
                          padding: const EdgeInsets.only(top: 48),
                          child: Column(
                            children: [
                              const Icon(
                                Icons.cloud_off_rounded,
                                size: 30,
                                color: AppColors.gray400,
                              ),
                              const SizedBox(height: 12),
                              // The raw exception was printed here — a stack
                              // trace's worth of internals in place of a
                              // sentence anyone can act on.
                              const Text(
                                'Não foi possível carregar a fila',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.gray900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Verifique a conexão e tente de novo.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.gray500,
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
                          return [_QueueEmptyState(label: selectedLabel)];
                        }
                        return [
                          for (final (i, item) in queue.indexed) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _ReviewListCard(
                              submission: item,
                              onTap: () => RegistrationDetailRoute(
                                id: item.id,
                              ).push(context),
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

/// An empty queue, in the shape the rest of the app's empty states use.
///
/// It was a single grey line, and the header said the same thing again in
/// different words directly above the chips — "Nenhuma submissão neste filtro"
/// and "Nenhum cadastro neste filtro" on screen at once.
class _QueueEmptyState extends StatelessWidget {
  const _QueueEmptyState({required this.label});

  /// The chip in effect, so the message says which queue is empty.
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.surfaceSecondary),
            ),
            child: const Icon(
              Icons.fact_check_outlined,
              size: 32,
              color: AppColors.navyDeep,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            switch (label) {
              'Em análise' => 'Nada para revisar',
              'Aprovados' => 'Nenhum cadastro aprovado',
              _ => 'Nenhum cadastro rejeitado',
            },
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label == 'Em análise'
                ? 'Os documentos enviados pelos representantes aparecem aqui.'
                : 'Os cadastros que você revisar aparecem aqui.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.gray500),
          ),
        ],
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
      color: selected ? AppColors.navyDeep : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? AppColors.navyDeep : AppColors.gray200,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppColors.gray600,
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
            border: Border.all(color: AppColors.surfaceSecondary),
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
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      submission.documentTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Por ${submission.submittedByName} · '
                      '${_relative(submission.submittedAt)}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
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
                    color: AppColors.gray400,
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

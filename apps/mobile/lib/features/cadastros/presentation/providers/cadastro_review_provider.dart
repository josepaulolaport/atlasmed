import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_repository.dart';

/// API status filter for the ops queue (`SUBMITTED` / `VALIDATED` / `REJECTED`).
final cadastroReviewApiStatusProvider = StateProvider<String>(
  (ref) => 'SUBMITTED',
);

final cadastroReviewQueueProvider =
    FutureProvider.autoDispose<List<CadastroReviewSubmission>>((ref) async {
      final status = ref.watch(cadastroReviewApiStatusProvider);
      final repo = CadastroReviewRepository(status: status);
      try {
        return await repo.loadQueue();
      } finally {
        repo.dispose();
      }
    });

/// One submission out of the loaded queue, as an [AsyncValue].
///
/// This returned a bare nullable before, so a queue that had not arrived yet
/// was indistinguishable from a submission that is not in it — and the detail
/// screen rendered "Submissão não encontrada" for the whole of the load.
final cadastroReviewByIdProvider = Provider.autoDispose
    .family<AsyncValue<CadastroReviewSubmission?>, int>((ref, id) {
      return ref
          .watch(cadastroReviewQueueProvider)
          .whenData(
            (queue) => queue.where((item) => item.id == id).firstOrNull,
          );
    });

final cadastroReviewActionsProvider = Provider<CadastroReviewActions>((ref) {
  return CadastroReviewActions(ref);
});

class CadastroReviewActions {
  CadastroReviewActions(this._ref);

  final Ref _ref;

  Future<void> approve(CadastroReviewSubmission submission) async {
    final repo = CadastroReviewRepository();
    try {
      await repo.approve(
        facilityId: submission.facilityId,
        recordId: submission.id,
      );
      _ref.invalidate(cadastroReviewQueueProvider);
    } finally {
      repo.dispose();
    }
  }

  Future<void> reject(
    CadastroReviewSubmission submission, {
    required String note,
  }) async {
    final repo = CadastroReviewRepository();
    try {
      await repo.reject(
        facilityId: submission.facilityId,
        recordId: submission.id,
        reviewerNote: note,
      );
      _ref.invalidate(cadastroReviewQueueProvider);
    } finally {
      repo.dispose();
    }
  }
}

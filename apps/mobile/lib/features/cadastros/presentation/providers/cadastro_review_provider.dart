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

final cadastroReviewByIdProvider =
    Provider.autoDispose.family<CadastroReviewSubmission?, String>((ref, id) {
      final queue = ref.watch(cadastroReviewQueueProvider).valueOrNull;
      if (queue == null) return null;
      for (final item in queue) {
        if (item.id == id) return item;
      }
      return null;
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

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_mock.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// In-memory Cadastros approval queue (Phase 1 mock). Approve/reject
/// mutate this list locally — no API yet.
class CadastroReviewQueueNotifier
    extends StateNotifier<List<CadastroReviewSubmission>> {
  CadastroReviewQueueNotifier() : super(mockCadastroReviewQueue());

  CadastroReviewSubmission? byId(String id) {
    for (final item in state) {
      if (item.id == id) return item;
    }
    return null;
  }

  void approve(String id, {required String reviewerName}) {
    _update(
      id,
      (item) => item.copyWith(
        status: EstablishmentDocumentStatus.approved,
        reviewedAt: DateTime.now(),
        reviewedByName: reviewerName,
        clearReviewerNote: true,
      ),
    );
  }

  void reject(String id, {required String reviewerName, required String note}) {
    _update(
      id,
      (item) => item.copyWith(
        status: EstablishmentDocumentStatus.rejected,
        reviewerNote: note,
        reviewedAt: DateTime.now(),
        reviewedByName: reviewerName,
      ),
    );
  }

  void _update(
    String id,
    CadastroReviewSubmission Function(CadastroReviewSubmission) map,
  ) {
    state = [
      for (final item in state)
        if (item.id == id) map(item) else item,
    ];
  }
}

final cadastroReviewQueueProvider =
    StateNotifierProvider<
      CadastroReviewQueueNotifier,
      List<CadastroReviewSubmission>
    >((ref) => CadastroReviewQueueNotifier());

final cadastroReviewByIdProvider =
    Provider.family<CadastroReviewSubmission?, String>((ref, id) {
      final queue = ref.watch(cadastroReviewQueueProvider);
      for (final item in queue) {
        if (item.id == id) return item;
      }
      return null;
    });

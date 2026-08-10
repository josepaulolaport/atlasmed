import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_normalize.dart';

final facilityCadastroProvider = FutureProvider.autoDispose
    .family<FacilityCadastroChecklist, int>((ref, facilityId) async {
      final repo = FacilityCadastroRepository(facilityId);
      try {
        return await repo.loadChecklist();
      } finally {
        repo.dispose();
      }
    });

final facilityCadastroControllerProvider = Provider.autoDispose
    .family<FacilityCadastroController, int>((ref, facilityId) {
      return FacilityCadastroController(ref, facilityId);
    });

class FacilityCadastroController {
  FacilityCadastroController(this._ref, this.facilityId);

  final Ref _ref;
  final int facilityId;

  Future<void> refresh() async {
    _ref.invalidate(facilityCadastroProvider(facilityId));
    await _ref.read(facilityCadastroProvider(facilityId).future);
  }

  Future<void> updateBillingEmail(String email) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      await repo.updateBillingEmail(email);
      await refresh();
    } finally {
      repo.dispose();
    }
  }

  /// Uploads files one-by-one; each file begins server-side processing
  /// as soon as its upload completes.
  Future<EstablishmentDocument> submitDocument({
    required int requirementId,
    required List<({String localPath, String fileName, String contentType})>
    files,
    void Function(int index, int total)? onFileStarted,
    void Function(int index, int total, double progress)? onFileProgress,
    FutureOr<void> Function(
      int index,
      int total, {
      int? fileId,
      String? status,
    })?
    onFileCompleted,
  }) async {
    final normalized = <FacilityCadastroFile>[];
    for (final file in files) {
      normalized.add(
        await normalizeCadastroUpload(
          localPath: file.localPath,
          fileName: file.fileName,
          contentType: file.contentType,
        ),
      );
    }

    final verticalId = await _ref.read(
      effectiveFacilityVerticalIdProvider.future,
    );
    final repo = FacilityCadastroRepository(facilityId);
    try {
      final uploaded = await repo.submitDocument(
        requirementId: requirementId,
        files: normalized,
        verticalId: verticalId,
        onFileStarted: onFileStarted,
        onFileProgress: onFileProgress,
        onFileCompleted: (index, total, {fileId, status}) async {
          await onFileCompleted?.call(
            index,
            total,
            fileId: fileId,
            status: status,
          );
          _ref.invalidate(facilityCadastroProvider(facilityId));
          await _ref.read(facilityCadastroProvider(facilityId).future);
        },
      );
      await refresh();
      return uploaded.copyWith(localPath: files.first.localPath);
    } finally {
      repo.dispose();
    }
  }

  Future<String> signedFileUrl(int fileAssetId) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      return await repo.getFileSignedUrl(fileAssetId);
    } finally {
      repo.dispose();
    }
  }

  Future<void> deleteDocument(int documentId) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      await repo.deleteDocument(documentId);
      await refresh();
    } finally {
      repo.dispose();
    }
  }

  Future<List<CadastroRequirementSubmission>> listRequirementSubmissions(
    int requirementId,
  ) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      return await repo.listRequirementSubmissions(requirementId);
    } finally {
      repo.dispose();
    }
  }

  Future<void> submitRequirement({
    required int requirementId,
    int? documentId,
  }) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      await repo.submitRequirement(
        requirementId: requirementId,
        documentId: documentId,
      );
      await refresh();
    } finally {
      repo.dispose();
    }
  }
}

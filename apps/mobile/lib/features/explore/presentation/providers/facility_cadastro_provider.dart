import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_normalize.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';

bool _isMockFacilityId(String facilityId) =>
    isMockNearbyFacilityId(facilityId);

final facilityCadastroProvider = FutureProvider.autoDispose
    .family<FacilityCadastroChecklist, String>((ref, facilityId) async {
      if (_isMockFacilityId(facilityId)) {
        return FacilityCadastroChecklist(
          facilityId: facilityId,
          documents: const [],
          pendingAction: 0,
        );
      }

      final repo = FacilityCadastroRepository(facilityId);
      try {
        return await repo.loadChecklist();
      } finally {
        repo.dispose();
      }
    });

final facilityCadastroControllerProvider = Provider.autoDispose
    .family<FacilityCadastroController, String>((ref, facilityId) {
      return FacilityCadastroController(ref, facilityId);
    });

class FacilityCadastroController {
  FacilityCadastroController(this._ref, this.facilityId);

  final Ref _ref;
  final String facilityId;

  Future<void> refresh() async {
    _ref.invalidate(facilityCadastroProvider(facilityId));
    await _ref.read(facilityCadastroProvider(facilityId).future);
  }

  Future<void> updateBillingEmail(String email) async {
    if (_isMockFacilityId(facilityId)) return;
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
    required String requirementId,
    required List<({String localPath, String fileName, String contentType})>
    files,
    void Function(int index, int total)? onFileStarted,
    void Function(int index, int total, double progress)? onFileProgress,
    FutureOr<void> Function(
      int index,
      int total, {
      String? fileId,
      String? status,
    })?
    onFileCompleted,
  }) async {
    if (_isMockFacilityId(facilityId)) {
      return EstablishmentDocument(
        id: requirementId,
        requirementId: requirementId,
        title: files.first.fileName,
        description: '',
        status: EstablishmentDocumentStatus.pending,
        submittedAt: DateTime.now(),
        fileName: files.first.fileName,
        localPath: files.first.localPath,
        mimeType: files.first.contentType,
      );
    }

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

    final repo = FacilityCadastroRepository(facilityId);
    try {
      final uploaded = await repo.submitDocument(
        requirementId: requirementId,
        files: normalized,
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

  Future<String> signedFileUrl(String fileAssetId) async {
    final repo = FacilityCadastroRepository(facilityId);
    try {
      return await repo.getFileSignedUrl(fileAssetId);
    } finally {
      repo.dispose();
    }
  }

  Future<void> submitPackage(String submissionId) async {
    if (_isMockFacilityId(facilityId)) return;
    final repo = FacilityCadastroRepository(facilityId);
    try {
      await repo.submitPackage(submissionId);
      await refresh();
    } finally {
      repo.dispose();
    }
  }

  Future<void> deleteDraft(String submissionId) async {
    if (_isMockFacilityId(facilityId)) return;
    final repo = FacilityCadastroRepository(facilityId);
    try {
      await repo.deleteDraft(submissionId);
      await refresh();
    } finally {
      repo.dispose();
    }
  }

  Future<List<CadastroRequirementSubmission>> listRequirementSubmissions(
    String requirementId,
  ) async {
    if (_isMockFacilityId(facilityId)) return const [];
    final repo = FacilityCadastroRepository(facilityId);
    try {
      return await repo.listRequirementSubmissions(requirementId);
    } finally {
      repo.dispose();
    }
  }

  Future<void> submitRequirement({
    required String requirementId,
    String? documentId,
  }) async {
    if (_isMockFacilityId(facilityId)) return;
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

import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// One file attached to an ops-queue Cadastro submission.
class CadastroReviewFile {
  const CadastroReviewFile({
    required this.fileAssetId,
    required this.fileName,
    this.contentType,
    this.remoteUrl,
    this.position = 1,
  });

  final int fileAssetId;
  final String fileName;
  final String? contentType;
  final String? remoteUrl;
  final int position;

  factory CadastroReviewFile.fromJson(Map<String, dynamic> json) {
    return CadastroReviewFile(
      fileAssetId:
          readCrmIdOrNull(json['fileAssetId'], 'fileAssetId') ??
          readCrmIdOrNull(json['id'], 'id') ??
          0,
      fileName:
          json['fileName'] as String? ??
          json['originalFilename'] as String? ??
          'arquivo',
      contentType:
          json['contentType'] as String? ?? json['mimeType'] as String?,
      remoteUrl: json['url'] as String?,
      position: (json['position'] as num?)?.toInt() ?? 1,
    );
  }
}

/// One item in the ops "Cadastros" approval queue — a document submission
/// paired with a snapshot of the clinic that submitted it.
class CadastroReviewSubmission {
  const CadastroReviewSubmission({
    required this.id,
    required this.facilityId,
    required this.facilityName,
    required this.documentTitle,
    required this.documentDescription,
    required this.documentFileName,
    required this.status,
    required this.submittedAt,
    required this.submittedByName,
    this.legalDocumentType,
    this.legalDocument,
    this.specialtyLabel,
    this.address,
    this.city,
    this.phone,
    this.email,
    this.consultantName,
    this.documentMimeType,
    this.documentLocalPath,
    this.remoteUrl,
    this.files = const [],
    this.reviewerNote,
    this.reviewedAt,
    this.reviewedByName,
  });

  final int id;
  final int facilityId;
  final String facilityName;

  /// Document requirement being reviewed (e.g. "Alvará de funcionamento").
  final String documentTitle;
  final String documentDescription;
  final String documentFileName;
  final String? documentMimeType;
  final String? documentLocalPath;
  final String? remoteUrl;
  final List<CadastroReviewFile> files;

  final EstablishmentDocumentStatus status;
  final DateTime submittedAt;
  final String submittedByName;

  // Clinic snapshot shown on the review detail screen.
  final FacilityLegalDocumentType? legalDocumentType;
  final String? legalDocument;
  final String? specialtyLabel;
  final String? address;
  final String? city;
  final String? phone;
  final String? email;
  final String? consultantName;

  final String? reviewerNote;
  final DateTime? reviewedAt;
  final String? reviewedByName;

  bool get isPending => status == EstablishmentDocumentStatus.pending;

  bool get isPdf {
    final mime = documentMimeType?.toLowerCase() ?? '';
    if (mime == 'application/pdf') return true;
    return documentFileName.toLowerCase().endsWith('.pdf');
  }

  bool get canPreviewImage {
    final mime = documentMimeType?.toLowerCase() ?? '';
    final name = documentFileName.toLowerCase();
    final isImage =
        mime.startsWith('image/') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp') ||
        name.endsWith('.heic');
    if (!isImage) return false;
    final hasLocal = documentLocalPath != null && documentLocalPath!.isNotEmpty;
    final hasRemote = remoteUrl != null && remoteUrl!.isNotEmpty;
    return hasLocal || hasRemote;
  }

  /// Thin adapter so we can reuse [ClinicDocumentViewerScreen].
  EstablishmentDocument get asDocument => EstablishmentDocument(
    id: id,
    title: documentTitle,
    description: documentDescription,
    status: status,
    submittedAt: submittedAt,
    fileName: documentFileName,
    localPath: documentLocalPath,
    remoteUrl: remoteUrl,
    mimeType: documentMimeType,
    reviewerNote: reviewerNote,
  );

  CadastroReviewSubmission copyWith({
    EstablishmentDocumentStatus? status,
    String? reviewerNote,
    DateTime? reviewedAt,
    String? reviewedByName,
    List<CadastroReviewFile>? files,
    bool clearReviewerNote = false,
  }) {
    return CadastroReviewSubmission(
      id: id,
      facilityId: facilityId,
      facilityName: facilityName,
      documentTitle: documentTitle,
      documentDescription: documentDescription,
      documentFileName: documentFileName,
      documentMimeType: documentMimeType,
      documentLocalPath: documentLocalPath,
      remoteUrl: remoteUrl,
      files: files ?? this.files,
      status: status ?? this.status,
      submittedAt: submittedAt,
      submittedByName: submittedByName,
      legalDocumentType: legalDocumentType,
      legalDocument: legalDocument,
      specialtyLabel: specialtyLabel,
      address: address,
      city: city,
      phone: phone,
      email: email,
      consultantName: consultantName,
      reviewerNote: clearReviewerNote
          ? null
          : (reviewerNote ?? this.reviewerNote),
      reviewedAt: reviewedAt ?? this.reviewedAt,
      reviewedByName: reviewedByName ?? this.reviewedByName,
    );
  }
}

import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

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
    this.taxIdType,
    this.taxId,
    this.specialtyLabel,
    this.address,
    this.city,
    this.phone,
    this.email,
    this.consultantName,
    this.documentMimeType,
    this.documentLocalPath,
    this.reviewerNote,
    this.reviewedAt,
    this.reviewedByName,
  });

  final String id;
  final String facilityId;
  final String facilityName;

  /// Document requirement being reviewed (e.g. "Alvará de funcionamento").
  final String documentTitle;
  final String documentDescription;
  final String documentFileName;
  final String? documentMimeType;
  final String? documentLocalPath;

  final EstablishmentDocumentStatus status;
  final DateTime submittedAt;
  final String submittedByName;

  // Clinic snapshot shown on the review detail screen.
  final FacilityTaxIdType? taxIdType;
  final String? taxId;
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
    if (documentLocalPath == null || documentLocalPath!.isEmpty) return false;
    final mime = documentMimeType?.toLowerCase() ?? '';
    if (mime.startsWith('image/')) return true;
    final name = documentFileName.toLowerCase();
    return name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.webp') ||
        name.endsWith('.heic');
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
    mimeType: documentMimeType,
    reviewerNote: reviewerNote,
  );

  CadastroReviewSubmission copyWith({
    EstablishmentDocumentStatus? status,
    String? reviewerNote,
    DateTime? reviewedAt,
    String? reviewedByName,
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
      status: status ?? this.status,
      submittedAt: submittedAt,
      submittedByName: submittedByName,
      taxIdType: taxIdType,
      taxId: taxId,
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

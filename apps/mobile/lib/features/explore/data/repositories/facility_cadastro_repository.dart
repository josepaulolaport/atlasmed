import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityCadastroException implements Exception {
  const FacilityCadastroException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityCadastroException';
}

class FacilityCadastroFile {
  const FacilityCadastroFile({
    required this.name,
    required this.bytes,
    required this.contentType,
  });

  final String name;
  final List<int> bytes;
  final String contentType;
}

class FacilityCadastroChecklist {
  const FacilityCadastroChecklist({
    required this.facilityId,
    required this.documents,
    required this.pendingAction,
    this.legalDocumentType,
    this.billingEmail,
    this.commercialStatus,
    this.conformityStatus,
    this.submissionId,
    this.submissionStatus,
    this.submissionVersion,
  });

  final int facilityId;
  final String? legalDocumentType;
  final String? billingEmail;
  final String? commercialStatus;
  final String? conformityStatus;
  final int? submissionId;
  final String? submissionStatus;
  final int? submissionVersion;
  final List<EstablishmentDocument> documents;
  final int pendingAction;

  List<EstablishmentDocument> get fileDocuments =>
      documents.where((d) => !d.isBillingEmail).toList(growable: false);

  bool get isDraftPackage =>
      submissionStatus == null ||
      submissionStatus == 'DRAFT' ||
      submissionStatus == 'CHANGES_REQUESTED';

  bool get isUnderReview => submissionStatus == 'UNDER_REVIEW';

  bool get canSubmitPackage {
    if (submissionId == null || submissionId! <= 0) return false;
    if (!isDraftPackage) return false;
    final files = fileDocuments;
    if (files.isEmpty) return false;
    return files.every(
      (d) =>
          d.files.isNotEmpty &&
          d.allFilesReady &&
          (d.status == EstablishmentDocumentStatus.ready ||
              d.status == EstablishmentDocumentStatus.approved),
    );
  }

  bool get hasDraftToDelete =>
      submissionId != null && submissionId! > 0 && isDraftPackage;

  bool get showPackageSubmitBar =>
      isDraftPackage &&
      submissionId != null &&
      submissionId! > 0 &&
      fileDocuments.isNotEmpty;

  int get readyDocumentCount => fileDocuments
      .where(
        (d) =>
            d.status == EstablishmentDocumentStatus.ready ||
            d.status == EstablishmentDocumentStatus.approved,
      )
      .length;
}

EstablishmentDocumentStatus _mapDocumentStatus({
  String? uiStatus,
  String? documentStatus,
}) {
  // Document-type surfaces: "Pronto" is reserved for approved official docs.
  // File-level READY belongs only on the compose upload tiles.
  switch (documentStatus) {
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return EstablishmentDocumentStatus.pending;
    case 'APPROVED':
      return EstablishmentDocumentStatus.approved;
    case 'REJECTED':
    case 'CHANGES_REQUESTED':
      return EstablishmentDocumentStatus.rejected;
    case 'READY':
    case 'PROCESSING':
    case 'DRAFT':
      return EstablishmentDocumentStatus.missing;
  }

  switch (uiStatus) {
    case 'pending':
      return EstablishmentDocumentStatus.pending;
    case 'approved':
      return EstablishmentDocumentStatus.approved;
    case 'rejected':
      return EstablishmentDocumentStatus.rejected;
    case 'ready':
    default:
      return EstablishmentDocumentStatus.missing;
  }
}

class FacilityCadastroRepository extends Repository<FacilityCadastroChecklist>
    with SessionEnvironmentMixin<FacilityCadastroChecklist> {
  FacilityCadastroRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro',
        ),
        name: 'FacilityCadastroRepository',
      );

  final int facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  Map<String, String> get _authHeaders {
    final token = SessionEnvironment.instance.currentValue?.token;
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> _jsonCall({
    required Uri uri,
    required RepositoryHttpMethod method,
    Map<String, dynamic>? body,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: uri,
        method: method,
        headers: _authHeaders,
        body: body ?? const {},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityCadastroException(
        _messageFromBody(response.body) ?? _messageFor(response.statusCode),
      );
    }
    if (response.body.isEmpty) return <String, dynamic>{};
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const FacilityCadastroException('Resposta inválida do servidor.');
    }
    return decoded;
  }

  @override
  FacilityCadastroChecklist fromJson(String json) {
    final map = jsonDecode(json) as Map<String, dynamic>;
    final docs = <EstablishmentDocument>[];

    final fileDocs = (map['documents'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    for (final item in fileDocs) {
      final record = item['record'] as Map<String, dynamic>?;
      final rawFiles = (item['files'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>();
      final files = rawFiles
          .map((f) {
            final fileAssetId = readCrmIdOrNull(
              f['fileAssetId'],
              'fileAssetId',
            );
            if (fileAssetId == null) return null;
            return CadastroDocumentFile(
              fileAssetId: fileAssetId,
              position: (f['position'] as num?)?.toInt() ?? 1,
              role: f['role'] as String? ?? 'PAGE',
              fileName: f['fileName'] as String?,
              status: f['status'] as String?,
              contentType: f['contentType'] as String?,
            );
          })
          .whereType<CadastroDocumentFile>()
          .toList(growable: false);
      final firstFile = files.isNotEmpty ? files.first : null;
      final documentStatus = item['documentStatus'] as String?;
      final approvedRaw = item['currentApproved'] as Map<String, dynamic>?;
      final latestSubmittedAtRaw = item['latestSubmittedAt'] as String?;
      final requirementId = readCrmId(item['requirementId'], 'requirementId');
      docs.add(
        EstablishmentDocument(
          id: requirementId,
          requirementId: requirementId,
          recordId:
              readCrmIdOrNull(item['documentId'], 'documentId') ??
              readCrmIdOrNull(record?['id'], 'id'),
          documentStatus: documentStatus,
          latestSubmittedStatus: item['latestSubmittedStatus'] as String?,
          latestSubmittedAt: latestSubmittedAtRaw != null
              ? DateTime.tryParse(latestSubmittedAtRaw)
              : null,
          currentApproved: approvedRaw != null
              ? CadastroApprovedSummary.fromJson(approvedRaw)
              : null,
          files: files,
          title:
              item['name'] as String? ?? item['slug'] as String? ?? 'Documento',
          description: item['description'] as String? ?? '',
          status: _mapDocumentStatus(
            uiStatus: item['uiStatus'] as String?,
            documentStatus: documentStatus,
          ),
          kind: EstablishmentDocumentKind.file,
          submittedAt: latestSubmittedAtRaw != null
              ? DateTime.tryParse(latestSubmittedAtRaw)
              : record?['submittedAt'] != null
              ? DateTime.tryParse(record!['submittedAt'] as String)
              : null,
          fileName: firstFile?.fileName ?? record?['fileName'] as String?,
          remoteUrl: record?['url'] as String?,
          mimeType: firstFile?.contentType ?? record?['contentType'] as String?,
          reviewerNote:
              item['reviewComment'] as String? ??
              record?['reviewerNote'] as String?,
        ),
      );
    }

    final billing = map['billing'] as Map<String, dynamic>?;
    if (billing != null) {
      docs.add(
        EstablishmentDocument(
          id: kBillingEmailEstablishmentDocumentId,
          title: billing['name'] as String? ?? 'Email Administrativo',
          description:
              billing['description'] as String? ??
              'Email administrativo do estabelecimento.',
          status: _mapDocumentStatus(uiStatus: billing['uiStatus'] as String?),
          kind: EstablishmentDocumentKind.billingEmail,
          billingEmail:
              billing['billingEmail'] as String? ??
              map['billingEmail'] as String?,
        ),
      );
    }

    final counts = map['counts'] as Map<String, dynamic>?;
    return FacilityCadastroChecklist(
      facilityId:
          readCrmIdOrNull(map['facilityId'], 'facilityId') ?? facilityId,
      legalDocumentType: map['legalDocumentType'] as String?,
      billingEmail: map['billingEmail'] as String?,
      commercialStatus: map['commercialStatus'] as String?,
      conformityStatus: map['conformityStatus'] as String?,
      submissionId: readCrmIdOrNull(map['submissionId'], 'submissionId'),
      submissionStatus: map['submissionStatus'] as String?,
      submissionVersion: (map['submissionVersion'] as num?)?.toInt(),
      documents: docs,
      pendingAction:
          (counts?['pendingAction'] as num?)?.toInt() ??
          docs.where((d) => d.status.needsAction).length,
    );
  }

  Future<FacilityCadastroChecklist> loadChecklist() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityCadastroException(
        'Não foi possível carregar o cadastro.',
      );
    }
    return result;
  }

  Future<void> updateBillingEmail(String email) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/billing-email',
    );
    await _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.put,
      body: {'email': email},
    );
  }

  Future<int> ensureDraftSubmission({int? verticalId}) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/submissions',
    );
    final map = await _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.post,
      body: {
        if (verticalId != null && (verticalId > 0)) 'verticalId': verticalId,
      },
    );
    final id = readCrmIdOrNull(map['id'], 'id');
    if (id == null || (id <= 0)) {
      throw const FacilityCadastroException('Falha ao criar rascunho.');
    }
    return id;
  }

  Future<int> ensureDocument({
    required int submissionId,
    required int requirementId,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/submissions/$submissionId/documents',
    );
    final map = await _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.post,
      body: {'requirementId': requirementId},
    );
    final id = readCrmIdOrNull(map['id'], 'id');
    if (id == null || (id <= 0)) {
      throw const FacilityCadastroException('Falha ao criar documento.');
    }
    return id;
  }

  Future<void> _putBytes(
    String url,
    List<int> bytes,
    String contentType,
  ) async {
    final ioClient = http.Client();
    try {
      final response = await ioClient.put(
        Uri.parse(url),
        headers: {'Content-Type': contentType},
        body: bytes,
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw FacilityCadastroException(
          'Falha no upload direto (${response.statusCode})',
        );
      }
    } finally {
      ioClient.close();
    }
  }

  Future<({int fileId, String status})> uploadFileToDocument({
    required int documentId,
    required FacilityCadastroFile file,
    String role = 'PAGE',
    int? position,
    void Function(double progress)? onProgress,
  }) async {
    final checksum = sha256.convert(file.bytes).toString();
    onProgress?.call(0.05);
    final initiateUri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/documents/$documentId/files/initiate',
    );
    final initiated = await _jsonCall(
      uri: initiateUri,
      method: RepositoryHttpMethod.post,
      body: {
        'filename': file.name,
        'contentType': file.contentType,
        'sizeBytes': file.bytes.length,
        'checksum': checksum,
        'role': role,
        // ignore: use_null_aware_elements — value-nullable map entry, not key-nullable.
        if (position != null) 'position': position,
      },
    );

    final method = initiated['method'] as String? ?? 'PUT';
    final fileId = readCrmIdOrNull(initiated['fileId'], 'fileId');
    if (fileId == null) {
      throw const FacilityCadastroException('fileId ausente na resposta.');
    }

    if (method == 'PUT') {
      final uploadUrl = initiated['uploadUrl'] as String?;
      if (uploadUrl == null) {
        throw const FacilityCadastroException('URL de upload ausente.');
      }
      onProgress?.call(0.2);
      await _putBytes(uploadUrl, file.bytes, file.contentType);
      onProgress?.call(0.85);
      final completeUri = Uri.parse(
        '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/uploads/complete',
      );
      final completed = await _jsonCall(
        uri: completeUri,
        method: RepositoryHttpMethod.post,
        body: {'fileId': fileId, 'checksum': checksum},
      );
      onProgress?.call(1);
      return (
        fileId: fileId,
        status: (completed['status'] as String?) ?? 'READY',
      );
    }

    // MULTIPART
    final uploadSessionId = readCrmIdOrNull(
      initiated['uploadSessionId'],
      'uploadSessionId',
    );
    final partSize =
        (initiated['partSizeBytes'] as num?)?.toInt() ?? 10 * 1024 * 1024;
    final totalParts = (initiated['totalParts'] as num?)?.toInt() ?? 1;
    if (uploadSessionId == null) {
      throw const FacilityCadastroException('Sessão multipart ausente.');
    }

    final partNumbers = List<int>.generate(totalParts, (i) => i + 1);
    final signUri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/uploads/$uploadSessionId/parts/sign',
    );
    final signed = await _jsonCall(
      uri: signUri,
      method: RepositoryHttpMethod.post,
      body: {'partNumbers': partNumbers},
    );
    final parts = (signed['parts'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    final completed = <Map<String, dynamic>>[];
    for (var i = 0; i < parts.length; i++) {
      final part = parts[i];
      final partNumber = (part['partNumber'] as num).toInt();
      final uploadUrl = part['uploadUrl'] as String;
      final start = (partNumber - 1) * partSize;
      final end = start + partSize > file.bytes.length
          ? file.bytes.length
          : start + partSize;
      final chunk = file.bytes.sublist(start, end);
      final ioClient = http.Client();
      try {
        final response = await ioClient.put(Uri.parse(uploadUrl), body: chunk);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw FacilityCadastroException(
            'Falha na parte $partNumber (${response.statusCode})',
          );
        }
        final etag = response.headers['etag'] ?? response.headers['ETag'] ?? '';
        completed.add({
          'partNumber': partNumber,
          'etag': etag.replaceAll('"', ''),
          'sizeBytes': chunk.length,
        });
        onProgress?.call(0.15 + (0.7 * (i + 1) / parts.length));
      } finally {
        ioClient.close();
      }
    }

    final completeUri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/uploads/complete',
    );
    final completedRes = await _jsonCall(
      uri: completeUri,
      method: RepositoryHttpMethod.post,
      body: {
        'fileId': fileId,
        'uploadSessionId': uploadSessionId,
        'checksum': checksum,
        'parts': completed,
      },
    );
    onProgress?.call(1);
    return (
      fileId: fileId,
      status: (completedRes['status'] as String?) ?? 'READY',
    );
  }

  /// Uploads one or many files for a requirement into the draft submission.
  /// Each file starts processing as soon as its upload completes.
  Future<EstablishmentDocument> submitDocument({
    required int requirementId,
    required List<FacilityCadastroFile> files,
    int? verticalId,
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
    if (files.isEmpty) {
      throw const FacilityCadastroException('Nenhum arquivo para enviar.');
    }
    final submissionId = await ensureDraftSubmission(verticalId: verticalId);
    final documentId = await ensureDocument(
      submissionId: submissionId,
      requirementId: requirementId,
    );

    // Append after any existing pages (API also coerces position if omitted).
    for (var i = 0; i < files.length; i++) {
      final file = files[i];
      onFileStarted?.call(i, files.length);
      final uploaded = await uploadFileToDocument(
        documentId: documentId,
        file: file,
        role: 'PAGE',
        onProgress: (p) => onFileProgress?.call(i, files.length, p),
      );
      if (uploaded.status == 'FAILED') {
        throw const FacilityCadastroException(
          'Processamento do arquivo falhou. Tente novamente.',
        );
      }
      await onFileCompleted?.call(
        i,
        files.length,
        fileId: uploaded.fileId,
        status: uploaded.status,
      );
    }

    return EstablishmentDocument(
      id: requirementId,
      requirementId: requirementId,
      recordId: documentId,
      title: files.first.name,
      description: '',
      status: EstablishmentDocumentStatus.pending,
      kind: EstablishmentDocumentKind.file,
      submittedAt: DateTime.now(),
      fileName: files.length == 1
          ? files.first.name
          : '${files.length} arquivos',
      mimeType: files.first.contentType,
    );
  }

  Future<void> deleteDraft(int submissionId) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/submissions/$submissionId',
    );
    await _jsonCall(uri: uri, method: RepositoryHttpMethod.delete);
  }

  Future<void> submitPackage(int submissionId) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/submissions/$submissionId/submit',
    );
    await _jsonCall(uri: uri, method: RepositoryHttpMethod.post);
  }

  Future<List<CadastroRequirementSubmission>> listRequirementSubmissions(
    int requirementId,
  ) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/requirements/$requirementId/submissions',
    );
    final map = await _jsonCall(uri: uri, method: RepositoryHttpMethod.get);
    final items = (map['items'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return items
        .map(CadastroRequirementSubmission.fromJson)
        .where((s) => s.documentId > 0)
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> submitRequirement({
    required int requirementId,
    int? documentId,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/requirements/$requirementId/submit',
    );
    return _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.post,
      body: {
        if (documentId != null && (documentId > 0)) 'documentId': documentId,
      },
    );
  }

  Future<String> getFileSignedUrl(int fileAssetId) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/files/$fileAssetId/url',
    );
    final map = await _jsonCall(uri: uri, method: RepositoryHttpMethod.get);
    final url = map['url'] as String?;
    if (url == null || url.isEmpty) {
      throw const FacilityCadastroException(
        'URL de visualização indisponível.',
      );
    }
    return url;
  }

  String _messageFor(int status) {
    if (status == 401 || status == 403) {
      return 'Você não tem permissão para atualizar este cadastro.';
    }
    if (status == 404) return 'Estabelecimento ou documento não encontrado.';
    if (status == 413) return 'Arquivo muito grande.';
    return 'Não foi possível enviar. Tente novamente.';
  }

  String? _messageFromBody(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        final errors = error['errors'];
        if (errors is List && errors.isNotEmpty) {
          final first = errors.first;
          if (first is Map && first['message'] is String) {
            return first['message'] as String;
          }
        }
        final message = error['message'];
        if (message is String &&
            message.trim().isNotEmpty &&
            message != 'Request validation failed' &&
            message != 'Invalid request data') {
          return message;
        }
      }
    } catch (_) {
      // Ignore malformed error payloads.
    }
    return null;
  }
}

/// Kept for call sites that still import File from dart:io via this library.
typedef CadastroLocalFile = File;
typedef CadastroBytes = Uint8List;

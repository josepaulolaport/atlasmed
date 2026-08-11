import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/cadastro_upload_limits.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_upload_transport.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Sign-and-upload passes over the parts still missing. Each round re-signs,
/// so this bounds how many times a resumed upload may re-derive fresh URLs
/// before the file (never the package) is reported as failed.
const int _maxMultipartRounds = 3;

String _sha256Hex(Uint8List bytes) => sha256.convert(bytes).toString();

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
  });

  final int facilityId;
  final String? legalDocumentType;
  final String? billingEmail;
  final String? commercialStatus;
  final String? conformityStatus;
  final List<EstablishmentDocument> documents;
  final int pendingAction;

  List<EstablishmentDocument> get fileDocuments =>
      documents.where((d) => !d.isBillingEmail).toList(growable: false);

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
  FacilityCadastroRepository(
    this.facilityId, {
    RepositoryHttpClient? client,
    CadastroUploadTransport? uploadTransport,
  }) : _client = client,
       _transport = uploadTransport ?? CadastroUploadTransport(),
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro',
         ),
         name: 'FacilityCadastroRepository',
       );

  final int facilityId;
  final RepositoryHttpClient? _client;
  final CadastroUploadTransport _transport;

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
          requiresValidityDate: item['requiresValidityDate'] as bool? ?? false,
          uploadLimits: CadastroUploadLimits.fromRequirementJson(item),
          validUntil: item['validUntil'] as String?,
          // Derived by the server at read time (ADR 0008 §4) — parsed, never
          // recomputed here.
          expiry: CadastroExpiry.fromJson(
            item['expiry'] as Map<String, dynamic>?,
          ),
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

  /// Opens (or returns) the document being worked on for this requirement.
  Future<int> ensureDocument({
    required int requirementId,
    int? verticalId,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/documents',
    );
    final map = await _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.post,
      body: {
        'requirementId': requirementId,
        if (verticalId != null && (verticalId > 0)) 'verticalId': verticalId,
      },
    );
    final id = readCrmIdOrNull(map['id'], 'id');
    if (id == null || (id <= 0)) {
      throw const FacilityCadastroException('Falha ao criar documento.');
    }
    return id;
  }

  /// Maps bytes-on-the-wire onto the progress band reserved for the transfer.
  ///
  /// `initiate` and `complete` own the ends of the bar. Progress is a property
  /// of the transfer alone — server-side processing is deliberately not part
  /// of it (spec 0011 §4.1: "Processando" is never shown).
  static double _transferProgress(int sentBytes, int totalBytes) {
    if (totalBytes <= 0) return 0.95;
    final ratio = (sentBytes / totalBytes).clamp(0.0, 1.0);
    return 0.05 + (0.90 * ratio);
  }

  Future<({int fileId, String status})> uploadFileToDocument({
    required int documentId,
    required FacilityCadastroFile file,
    String role = 'PAGE',
    int? position,
    void Function(double progress)? onProgress,
  }) async {
    final bytes = file.bytes is Uint8List
        ? file.bytes as Uint8List
        : Uint8List.fromList(file.bytes);
    // Hashing 20 MB blocks the UI isolate for hundreds of milliseconds.
    final checksum = await compute(_sha256Hex, bytes);
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
        'sizeBytes': bytes.length,
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
      await _transport.put(
        url: Uri.parse(uploadUrl),
        body: bytes,
        contentType: file.contentType,
        onSent: (sent) =>
            onProgress?.call(_transferProgress(sent, bytes.length)),
      );
      onProgress?.call(0.95);
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

    // A part already stored is never sent again. Each round re-signs only what
    // is still missing, which is both the resume path (connectivity returns,
    // the remaining parts continue) and the fix for a signature that expired
    // while earlier parts were moving.
    final storedParts = <int, Map<String, dynamic>>{};
    var bytesStored = 0;
    CadastroUploadTransportException? lastTransportFailure;

    for (var round = 0; round < _maxMultipartRounds; round++) {
      final missing = partNumbers
          .where((n) => !storedParts.containsKey(n))
          .toList(growable: false);
      if (missing.isEmpty) break;

      try {
        final signed = await _jsonCall(
          uri: signUri,
          method: RepositoryHttpMethod.post,
          body: {'partNumbers': missing},
        );
        final parts = (signed['parts'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();

        for (final part in parts) {
          final partNumber = (part['partNumber'] as num).toInt();
          final uploadUrl = part['uploadUrl'] as String;
          final start = (partNumber - 1) * partSize;
          final end = start + partSize > bytes.length
              ? bytes.length
              : start + partSize;
          final chunk = Uint8List.sublistView(bytes, start, end);

          final response = await _transport.put(
            url: Uri.parse(uploadUrl),
            body: chunk,
            onSent: (sent) => onProgress?.call(
              _transferProgress(bytesStored + sent, bytes.length),
            ),
          );

          // Dart lowercases response header keys; the lowercase lookup is the
          // one that hits. The uppercase fallback stays for a client that does
          // not (ADR 0008 records D-13 as a non-defect).
          final etag =
              (response.headers['etag'] ?? response.headers['ETag'] ?? '')
                  .replaceAll('"', '');
          if (etag.isEmpty) {
            // Completing without it would 422 after the bytes moved and leave
            // a multipart nothing aborts. Fail here, where it is legible.
            throw FacilityCadastroException(
              'Parte $partNumber aceita sem ETag; upload não pode ser concluído.',
            );
          }
          storedParts[partNumber] = {
            'partNumber': partNumber,
            'etag': etag,
            'sizeBytes': chunk.length,
          };
          bytesStored += chunk.length;
          onProgress?.call(_transferProgress(bytesStored, bytes.length));
        }
      } on CadastroUploadTransportException catch (error) {
        lastTransportFailure = error;
        // Parts already stored survive; the next round resumes from here.
      }
    }

    if (storedParts.length != totalParts) {
      throw FacilityCadastroException(
        lastTransportFailure?.message ??
            'Upload interrompido: ${storedParts.length} de $totalParts partes enviadas.',
      );
    }

    final completed = partNumbers
        .map((n) => storedParts[n]!)
        .toList(growable: false);

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
    final documentId = await ensureDocument(
      requirementId: requirementId,
      verticalId: verticalId,
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

  /// Discards one unsent document and the files behind it.
  Future<void> deleteDocument(int documentId) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/documents/$documentId',
    );
    await _jsonCall(uri: uri, method: RepositoryHttpMethod.delete);
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

  /// Sends one requirement for review.
  ///
  /// [validUntil] is `YYYY-MM-DD` and must be present exactly where the
  /// requirement declares a validity: the API rejects the submit without one,
  /// and rejects one sent for a requirement that declares none (spec 0011
  /// §3.3), so the field is omitted rather than sent null.
  Future<Map<String, dynamic>> submitRequirement({
    required int requirementId,
    int? documentId,
    String? validUntil,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/requirements/$requirementId/submit',
    );
    return _jsonCall(
      uri: uri,
      method: RepositoryHttpMethod.post,
      body: {
        if (documentId != null && (documentId > 0)) 'documentId': documentId,
        if (validUntil != null && validUntil.isNotEmpty)
          'validUntil': validUntil,
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

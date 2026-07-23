import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class CadastroReviewException implements Exception {
  const CadastroReviewException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'CadastroReviewException';
}

EstablishmentDocumentStatus _mapStatus(String? raw) {
  switch (raw) {
    case 'VALIDATED':
    case 'APPROVED':
      return EstablishmentDocumentStatus.approved;
    case 'REJECTED':
      return EstablishmentDocumentStatus.rejected;
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return EstablishmentDocumentStatus.pending;
    default:
      return EstablishmentDocumentStatus.pending;
  }
}

class CadastroReviewRepository extends Repository<List<CadastroReviewSubmission>>
    with SessionEnvironmentMixin<List<CadastroReviewSubmission>> {
  CadastroReviewRepository({
    this.status = 'SUBMITTED',
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${AppConfig.apiBaseUrl}/api/v1/cadastro/submissions?status=$status',
         ),
         resolveOnCreate: false,
         name: 'CadastroReviewRepository',
       );

  final String status;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<CadastroReviewSubmission> fromJson(String json) {
    final map = jsonDecode(json) as Map<String, dynamic>;
    final data = (map['data'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return data.map(_fromApi).toList(growable: false);
  }

  CadastroReviewSubmission _fromApi(Map<String, dynamic> item) {
    final requirement = item['requirement'] as Map<String, dynamic>? ?? const {};
    final facility = item['facility'] as Map<String, dynamic>? ?? const {};
    final taxIdType = parseFacilityTaxIdType(facility['taxIdType'] as String?);
    final rawFiles = (item['files'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final files = rawFiles
        .map(CadastroReviewFile.fromJson)
        .where((f) => f.fileAssetId.isNotEmpty)
        .toList(growable: false);
    final first = files.isNotEmpty ? files.first : null;
    return CadastroReviewSubmission(
      id: item['id'] as String,
      facilityId: item['facilityId'] as String? ?? facility['id'] as String? ?? '',
      facilityName: facility['name'] as String? ?? 'Estabelecimento',
      documentTitle: requirement['name'] as String? ?? 'Documento',
      documentDescription: requirement['description'] as String? ?? '',
      documentFileName:
          first?.fileName ?? item['fileName'] as String? ?? 'documento',
      documentMimeType: first?.contentType ?? item['contentType'] as String?,
      documentLocalPath: null,
      remoteUrl: first?.remoteUrl ?? item['url'] as String?,
      files: files,
      status: _mapStatus(item['status'] as String?),
      submittedAt: item['submittedAt'] != null
          ? DateTime.tryParse(item['submittedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      submittedByName: 'Representante',
      taxIdType: taxIdType,
      taxId: facility['taxId'] as String?,
      address: facility['address'] as String?,
      city: facility['city'] as String?,
      phone: facility['phone'] as String?,
      email: facility['email'] as String?,
      consultantName: facility['consultantName'] as String?,
      reviewerNote: item['reviewerNote'] as String?,
    );
  }

  Future<List<CadastroReviewSubmission>> loadQueue() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const CadastroReviewException(
        'Não foi possível carregar a fila de cadastros.',
      );
    }
    return result;
  }

  Future<void> approve({
    required String facilityId,
    required String recordId,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/documents/$recordId/review',
    );
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: uri,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: const {'decision': 'APPROVED'},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CadastroReviewException(_messageFor(response.statusCode));
    }
  }

  Future<void> reject({
    required String facilityId,
    required String recordId,
    required String reviewerNote,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/cadastro/documents/$recordId/review',
    );
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: uri,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'decision': 'REJECTED',
          'comment': reviewerNote,
        },
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CadastroReviewException(_messageFor(response.statusCode));
    }
  }

  String _messageFor(int status) {
    if (status == 401 || status == 403) {
      return 'Você não tem permissão para revisar cadastros.';
    }
    if (status == 404) return 'Submissão não encontrada.';
    return 'Não foi possível concluir a revisão. Tente novamente.';
  }
}

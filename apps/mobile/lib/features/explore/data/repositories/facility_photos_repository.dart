import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityPhotosException implements Exception {
  const FacilityPhotosException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityPhotosException';
}

class FacilityPhotoFile {
  const FacilityPhotoFile({
    required this.name,
    required this.bytes,
    required this.contentType,
  });

  final String name;
  final List<int> bytes;
  final String contentType;
}

class FacilityPhotosResponse {
  const FacilityPhotosResponse({
    required this.imageUrl,
    required this.photos,
  });

  factory FacilityPhotosResponse.fromJson(String json) {
    final map = jsonDecode(json) as Map<String, dynamic>;
    final data = (map['data'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return FacilityPhotosResponse(
      imageUrl: map['imageUrl'] as String?,
      photos: data
          .map(
            (item) => (
              id: item['id'] as String,
              url: item['url'] as String,
            ),
          )
          .toList(growable: false),
    );
  }

  final String? imageUrl;
  final List<({String id, String url})> photos;

  PhotoGallerySummary toSummary() {
    final urls = photos.map((p) => p.url).toList(growable: false);
    return PhotoGallerySummary(
      count: urls.length,
      imageUrls: urls,
      profileImageUrl: imageUrl ?? (urls.isEmpty ? null : urls.first),
    );
  }
}

class FacilityPhotosRepository extends Repository<FacilityPhotosResponse>
    with SessionEnvironmentMixin<FacilityPhotosResponse> {
  FacilityPhotosRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/photos',
        ),
        resolveOnCreate: false,
        name: 'FacilityPhotosRepository',
      );

  final String facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  FacilityPhotosResponse fromJson(String json) =>
      FacilityPhotosResponse.fromJson(json);

  Future<PhotoGallerySummary> loadGallery() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityPhotosException();
    }
    return result.toSummary();
  }

  /// Multipart upload (`photo` field) — mirrors profile avatar upload.
  Future<({String id, String url})> upload(FacilityPhotoFile file) async {
    final token = SessionEnvironment.instance.currentValue?.token;
    if (token == null || token.isEmpty) {
      throw const FacilityPhotosException(
        'Sua sessão expirou. Entre novamente.',
      );
    }

    final multipart = http.MultipartRequest('POST', endpoint)
      ..headers['Authorization'] = 'Bearer $token'
      ..files.add(
        http.MultipartFile.fromBytes(
          'photo',
          Uint8List.fromList(file.bytes),
          filename: file.name,
          contentType: MediaType.parse(file.contentType),
        ),
      );

    final streamed = await multipart.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FacilityPhotosException(_messageFor(response.statusCode));
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const FacilityPhotosException(
        'A resposta do servidor é inválida.',
      );
    }

    final id = decoded['id'] as String?;
    final url = decoded['url'] as String?;
    if (id == null || url == null) {
      throw const FacilityPhotosException(
        'A resposta do servidor é inválida.',
      );
    }

    await refresh();
    return (id: id, url: url);
  }

  String _messageFor(int statusCode) {
    if (statusCode == 400) {
      return 'Escolha uma imagem JPG, PNG ou WebP de até 5 MB.';
    }
    if (statusCode == 401) {
      return 'Sua sessão expirou. Entre novamente.';
    }
    if (statusCode == 403) {
      return 'Você não tem permissão para alterar fotos deste estabelecimento.';
    }
    return 'Não foi possível enviar a foto. Tente novamente.';
  }
}

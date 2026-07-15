import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models/user.dart';

typedef AvatarRequest =
    Future<Map<String, dynamic>> Function(AvatarHttpRequest request);

class AvatarFile {
  const AvatarFile({
    required this.name,
    required this.bytes,
    required this.contentType,
  });

  final String name;
  final List<int> bytes;
  final String contentType;
}

class AvatarHttpRequest {
  const AvatarHttpRequest({
    required this.url,
    required this.method,
    required this.headers,
    this.file,
  });

  final Uri url;
  final String method;
  final Map<String, String> headers;
  final AvatarFile? file;
}

class AvatarRepository {
  AvatarRepository({
    required String baseUrl,
    required Future<String?> Function() tokenProvider,
    AvatarRequest? request,
  }) : _baseUrl = baseUrl,
       _tokenProvider = tokenProvider,
       _request = request;

  final String _baseUrl;
  final Future<String?> Function() _tokenProvider;
  final AvatarRequest? _request;

  Future<User> upload(AvatarFile file) async {
    return _send(method: 'POST', file: file);
  }

  Future<User> remove() => _send(method: 'DELETE');

  Future<User> _send({required String method, AvatarFile? file}) async {
    final token = await _tokenProvider();
    if (token == null || token.isEmpty) {
      throw const AvatarRepositoryException(
        'Sua sessão expirou. Entre novamente.',
      );
    }

    final request = AvatarHttpRequest(
      url: Uri.parse('$_baseUrl/api/v1/user/avatar'),
      method: method,
      headers: {'Authorization': 'Bearer $token'},
      file: file,
    );

    final payload = _request != null
        ? await _request(request)
        : await _performRequest(request);
    final userJson = payload['user'];
    if (userJson is! Map<String, dynamic>) {
      throw const AvatarRepositoryException(
        'A resposta do servidor é inválida.',
      );
    }
    return User.fromJson(userJson);
  }

  Future<Map<String, dynamic>> _performRequest(
    AvatarHttpRequest request,
  ) async {
    http.Response response;
    if (request.method == 'POST') {
      final multipart = http.MultipartRequest('POST', request.url)
        ..headers.addAll(request.headers)
        ..files.add(
          http.MultipartFile.fromBytes(
            'avatar',
            Uint8List.fromList(request.file!.bytes),
            filename: request.file!.name,
            contentType: MediaType.parse(request.file!.contentType),
          ),
        );
      final streamed = await multipart.send();
      response = await http.Response.fromStream(streamed);
    } else {
      response = await http.delete(request.url, headers: request.headers);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AvatarRepositoryException(_messageFor(response.statusCode));
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const AvatarRepositoryException(
        'A resposta do servidor é inválida.',
      );
    }
    return decoded;
  }

  String _messageFor(int statusCode) {
    if (statusCode == 400) {
      return 'Escolha uma imagem JPG, PNG ou WebP de até 5 MB.';
    }
    if (statusCode == 401) {
      return 'Sua sessão expirou. Entre novamente.';
    }
    return 'Não foi possível atualizar sua foto. Tente novamente.';
  }
}

class AvatarRepositoryException implements Exception {
  const AvatarRepositoryException(this.message);
  final String message;

  @override
  String toString() => message;
}

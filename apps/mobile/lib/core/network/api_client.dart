import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokenStorage: ref.watch(tokenStorageProvider));
});

class ApiClient {
  ApiClient({
    required TokenStorage tokenStorage,
    http.Client? httpClient,
  })  : _tokenStorage = tokenStorage,
        _http = httpClient ?? http.Client();

  final TokenStorage _tokenStorage;
  final http.Client _http;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
    bool auth = true,
  }) async {
    return _request('GET', path, query: query, auth: auth);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _request('POST', path, body: body, auth: auth);
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
    bool auth = true,
    bool retrying = false,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, v)),
    );

    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (auth) {
      final token = await _tokenStorage.readAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    if (kDebugMode) {
      debugPrint('[API] $method $uri');
    }

    http.StreamedResponse response;
    try {
      response = await _http.send(
        http.Request(method, uri)
          ..headers.addAll(headers)
          ..body = body == null ? '' : jsonEncode(body),
      );
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message: 'Sem conexão com a API (${uri.host}:${uri.port}). '
            'Confirme que o backend está rodando.',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Erro de rede: $e',
        code: 'NETWORK_ERROR',
      );
    }

    final responseBody = await response.stream.bytesToString();

    if (response.statusCode == 401 && auth && !retrying) {
      final refreshed = await _refreshSession();
      if (refreshed) {
        return _request(
          method,
          path,
          query: query,
          body: body,
          auth: auth,
          retrying: true,
        );
      }
    }

    Map<String, dynamic> decoded;
    try {
      decoded = responseBody.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(responseBody) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        statusCode: response.statusCode,
        message: responseBody.isEmpty ? 'Empty response' : responseBody,
      );
    }

    if (response.statusCode >= 400) {
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        throw ApiException(
          statusCode: response.statusCode,
          message: error['message']?.toString() ?? 'Request failed',
          code: error['code']?.toString(),
        );
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: decoded['message']?.toString() ?? 'Request failed',
      );
    }

    return decoded;
  }

  Future<bool> _refreshSession() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) return false;

    try {
      final data = await _request(
        'POST',
        '/access/refresh',
        body: {'refreshToken': refreshToken},
        auth: false,
        retrying: true,
      );

      final session = data['session'] as Map<String, dynamic>?;
      final user = data['user'] as Map<String, dynamic>?;
      if (session == null || user == null) return false;

      final displayName = [
        user['firstName']?.toString(),
        user['lastName']?.toString(),
      ].where((p) => p != null && p.isNotEmpty).join(' ');

      await _tokenStorage.saveSession(
        userId: user['id'].toString(),
        accessToken: session['token'].toString(),
        refreshToken: data['refreshToken']?.toString() ?? refreshToken,
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
        userDisplayName: displayName.isEmpty
            ? user['email']?.toString() ?? 'Usuário'
            : displayName,
      );

      return true;
    } catch (_) {
      await _tokenStorage.clear();
      return false;
    }
  }
}

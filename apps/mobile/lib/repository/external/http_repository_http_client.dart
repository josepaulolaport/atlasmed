import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/network_unavailable_exception.dart';
import 'package:atlasmed_mobile_app/core/session/user_activity.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_logger.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

final _client = http.Client();

typedef BearerToken = String;
typedef TokenBuilder = FutureOr<BearerToken?> Function();

/// {@template http_repository_http_client}
/// A [RepositoryHttpClient] that uses `http` package.
/// {@endtemplate}
class HttpRepositoryHttpClient extends RepositoryHttpClient {
  /// {@macro http_repository_http_client}
  const HttpRepositoryHttpClient({this.tokenBuilder, super.mocks});

  /// The token builder for this specific request.
  /// If provided, this will be used instead of the static tokenBuilder.
  final TokenBuilder? tokenBuilder;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    try {
      final tokenWithBearerPrefix = await tokenBuilder?.call();

      final headers = Map<String, String>.from(request.headers);

      if (tokenWithBearerPrefix != null && tokenWithBearerPrefix.isNotEmpty) {
        headers['Authorization'] = 'Bearer $tokenWithBearerPrefix';
      }

      // Spec 0015 §4.1: only requests a person set in motion move
      // `last_seen_at`. Absent on timer traffic, which is the point.
      if (UserActivity.instance.isActive) {
        headers['X-Client-Activity'] = '1';
      }

      final encodedBody = request.body == null
          ? null
          : jsonEncode(request.body);

      final metadata = <String, String>{
        'method': request.method.name.toUpperCase(),
        'url': request.url.toString(),
        'headers': redactHeaders(headers).toString(),
        'body': encodedBody ?? '',
      };

      BaseRepository.logger('[REQUEST] $metadata');

      final mockedResponse = super.findMock(request);

      if (mockedResponse != null) {
        return mockedResponse;
      }

      final response = switch (request.method) {
        .get => await _client.get(request.url, headers: headers),
        .post => await _client.post(
          request.url,
          headers: headers,
          body: encodedBody,
        ),
        .patch => await _client.patch(
          request.url,
          headers: headers,
          body: encodedBody,
        ),
        .put => await _client.put(
          request.url,
          headers: headers,
          body: encodedBody,
        ),
        .delete => await _client.delete(
          request.url,
          headers: headers,
          body: encodedBody,
        ),
      };

      BaseRepository.logger(
        '[RESPONSE] ${response.statusCode} ${_hideJwt(response.body)}]',
      );

      return RepositoryHttpResponse(
        statusCode: response.statusCode,
        body: response.body,
        headers: response.headers,
        requestHeaders: headers,
      );
    } on SocketException catch (e) {
      BaseRepository.logger(
        'SocketException: ${request.url}',
        level: RepositoryLoggingLevel.error,
      );
      throw NetworkUnavailableException(e);
    } on http.ClientException catch (e) {
      BaseRepository.logger(
        'ClientException: ${request.url}',
        level: RepositoryLoggingLevel.error,
      );
      throw NetworkUnavailableException(e);
    }
  }

  static final RegExp _jwtRegex = RegExp(r'((?:[\w-]*\.){2}[\w-]*)');
  String _hideJwt(String raw) {
    var result = raw;
    if (kDebugMode) {
      return raw;
    }
    for (final match in _jwtRegex.allMatches(raw)) {
      result = result.replaceRange(match.start, match.end, 'hidden');
    }
    return result;
  }
}

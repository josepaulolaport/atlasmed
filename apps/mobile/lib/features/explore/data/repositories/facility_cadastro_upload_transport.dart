import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:http/http.dart' as http;

/// Bytes handed to the socket per pump. Small enough that progress moves
/// smoothly on a slow link, large enough not to dominate the transfer in
/// per-chunk overhead.
const int _chunkSizeBytes = 64 * 1024;

/// A transfer that did not produce a usable response.
///
/// [retryable] separates "the network misbehaved" from "the store said no".
/// Only the former is worth sending the same bytes again; a signature that
/// expired needs a fresh URL, which is the caller's job.
class CadastroUploadTransportException implements Exception {
  const CadastroUploadTransportException(
    this.message, {
    required this.retryable,
    this.statusCode,
  });

  final String message;
  final bool retryable;
  final int? statusCode;

  @override
  String toString() => message;
}

class CadastroTransferResponse {
  const CadastroTransferResponse({
    required this.statusCode,
    required this.headers,
  });

  final int statusCode;
  final Map<String, String> headers;
}

/// PUTs bytes straight at the object store with upload progress, a stall
/// timeout and bounded retry.
///
/// The app's own API client cannot be reused here: these requests carry no
/// session, must not be logged with their signed URL, and are the only place
/// where the client streams a large body. A bare `http.Client().put()` buffers
/// the whole body and reports nothing until it is over — which is what made a
/// 20 MB upload look frozen and then time out with no way to tell the two
/// apart (spec 0011 §4.3).
class CadastroUploadTransport {
  CadastroUploadTransport({
    http.Client Function()? clientFactory,
    this.maxAttempts = 4,
    this.stallTimeout = const Duration(seconds: 45),
    Future<void> Function(Duration)? delay,
  }) : _clientFactory = clientFactory ?? http.Client.new,
       _delay = delay ?? _sleep;

  final http.Client Function() _clientFactory;
  final Future<void> Function(Duration) _delay;

  /// Total attempts for one transfer, first included.
  final int maxAttempts;

  /// How long the socket may accept nothing before the attempt is abandoned.
  /// A wall-clock deadline would kill a slow-but-progressing upload; only a
  /// lack of progress means the transfer is actually dead.
  final Duration stallTimeout;

  /// Sends [body] and reports cumulative bytes accepted by the socket.
  ///
  /// [onSent] is called with the byte count **for the current attempt**, and
  /// with `0` when an attempt is abandoned and restarted, so a caller
  /// aggregating several transfers never double-counts a retried one.
  Future<CadastroTransferResponse> put({
    required Uri url,
    required Uint8List body,
    String? contentType,
    void Function(int sentBytes)? onSent,
  }) async {
    var attempt = 0;
    while (true) {
      attempt++;
      try {
        return await _attempt(
          url: url,
          body: body,
          contentType: contentType,
          onSent: onSent,
        );
      } on CadastroUploadTransportException catch (error) {
        if (!error.retryable || attempt >= maxAttempts) rethrow;
        // The next attempt re-sends from byte zero; say so rather than letting
        // the caller's bar sit at a number that is no longer true.
        onSent?.call(0);
        await _delay(_backoff(attempt));
      }
    }
  }

  Future<CadastroTransferResponse> _attempt({
    required Uri url,
    required Uint8List body,
    required String? contentType,
    required void Function(int sentBytes)? onSent,
  }) async {
    final client = _clientFactory();
    var stalled = false;
    Timer? watchdog;

    void armWatchdog() {
      watchdog?.cancel();
      watchdog = Timer(stallTimeout, () {
        stalled = true;
        // Forces the in-flight request to fail; there is no other way to
        // abandon a socket that has stopped draining.
        client.close();
      });
    }

    try {
      final request = _ProgressRequest(url, body, (sent) {
        armWatchdog();
        onSent?.call(sent);
      });
      if (contentType != null && contentType.isNotEmpty) {
        request.headers['content-type'] = contentType;
      }
      armWatchdog();

      final response = await client.send(request);
      // Drain the body even on success: an undrained response keeps the
      // connection pinned open.
      final responseBody = await response.stream.bytesToString();
      watchdog?.cancel();

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw CadastroUploadTransportException(
          'Falha no upload direto (${response.statusCode})'
          '${_detail(responseBody)}',
          retryable: _statusIsRetryable(response.statusCode),
          statusCode: response.statusCode,
        );
      }
      return CadastroTransferResponse(
        statusCode: response.statusCode,
        headers: response.headers,
      );
    } on CadastroUploadTransportException {
      rethrow;
    } on Object catch (error) {
      if (stalled) {
        throw CadastroUploadTransportException(
          'Upload sem progresso por ${stallTimeout.inSeconds}s.',
          retryable: true,
        );
      }
      if (error is http.ClientException ||
          error is SocketException ||
          error is HandshakeException ||
          error is TimeoutException) {
        throw CadastroUploadTransportException(
          'Falha de rede no upload: $error',
          retryable: true,
        );
      }
      rethrow;
    } finally {
      watchdog?.cancel();
      client.close();
    }
  }

  Duration _backoff(int attempt) {
    final millis = 400 * math.pow(2, attempt - 1).toInt();
    return Duration(milliseconds: math.min(millis, 8000));
  }

  static bool _statusIsRetryable(int status) =>
      status >= 500 || status == 408 || status == 429;

  static String _detail(String body) {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return '';
    return ': ${trimmed.length > 200 ? trimmed.substring(0, 200) : trimmed}';
  }

  static Future<void> _sleep(Duration duration) =>
      Future<void>.delayed(duration);
}

/// A PUT whose body is pumped chunk by chunk so progress reflects bytes the
/// socket actually accepted, not bytes handed to a buffer.
class _ProgressRequest extends http.BaseRequest {
  _ProgressRequest(Uri url, this._body, this._onSent) : super('PUT', url) {
    contentLength = _body.length;
  }

  final Uint8List _body;
  final void Function(int sentBytes) _onSent;

  @override
  http.ByteStream finalize() {
    super.finalize();
    return http.ByteStream(_pump());
  }

  Stream<List<int>> _pump() async* {
    var sent = 0;
    if (_body.isEmpty) {
      _onSent(0);
      return;
    }
    while (sent < _body.length) {
      final end = math.min(sent + _chunkSizeBytes, _body.length);
      // The consumer applies backpressure, so this generator only resumes
      // once the previous chunk is on the wire.
      yield Uint8List.sublistView(_body, sent, end);
      sent = end;
      _onSent(sent);
    }
  }
}

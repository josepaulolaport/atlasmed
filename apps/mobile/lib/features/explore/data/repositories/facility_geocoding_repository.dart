import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Address ⇄ pin, server-side.
///
/// Extracted from the CNES import repository, which is where both calls first
/// appeared and where neither belongs: `/facilities/geocode` and
/// `/facilities/reverse-geocode` know nothing about CNES, and the clinic's
/// endereço suggestion needs exactly the same pair to offer the same
/// geocode-and-drag experience the import wizard has.
class FacilityGeocodingRepository {
  FacilityGeocodingRepository({String? baseUrl, RepositoryHttpClient? client})
    : _base = '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1',
      _client =
          client ??
          createPlatformHttpClient(
            tokenBuilder: SessionEnvironment.instance.tokenBuilder,
          );

  final String _base;
  final RepositoryHttpClient _client;

  bool _ok(int status) => status >= 200 && status < 300;

  /// Where an address sits, or null when the provider cannot place it.
  ///
  /// Server-side so the wizard lands on the coordinates the backfill script
  /// would have chosen — it does the CEP lookup and the candidate scoring that
  /// a raw Mapbox call from here would skip.
  Future<GeocodedPoint?> geocodeAddress({
    String? streetAddress,
    String? streetNumber,
    String? neighborhood,
    String? city,
    String? state,
    String? postalCode,
  }) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_base/facilities/geocode'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          if ((streetAddress ?? '').trim().isNotEmpty)
            'streetAddress': streetAddress!.trim(),
          if ((streetNumber ?? '').trim().isNotEmpty)
            'streetNumber': streetNumber!.trim(),
          if ((neighborhood ?? '').trim().isNotEmpty)
            'neighborhood': neighborhood!.trim(),
          if ((city ?? '').trim().isNotEmpty) 'city': city!.trim(),
          if ((state ?? '').trim().isNotEmpty) 'state': state!.trim(),
          if ((postalCode ?? '').trim().isNotEmpty)
            'postalCode': postalCode!.trim(),
        },
      ),
    );

    if (!_ok(response.statusCode)) {
      throw CnesFacilityImportException(
        _messageOf(response.body) ??
            'Não foi possível localizar o endereço (${response.statusCode})',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) return null;
    final point = decoded['point'];
    if (point is! Map<String, dynamic>) return null;
    final lat = (point['lat'] as num?)?.toDouble();
    final lng = (point['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    return GeocodedPoint(latitude: lat, longitude: lng);
  }

  /// The address a dropped pin sits at. Spec 0009 decision 4: an address and a
  /// pin are two views of one fact, so moving the pin re-derives the address.
  Future<ReverseGeocodedAddress?> reverseGeocode({
    required double latitude,
    required double longitude,
  }) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_base/facilities/reverse-geocode'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'lat': latitude, 'lng': longitude},
      ),
    );

    if (!_ok(response.statusCode)) {
      throw CnesFacilityImportException(
        _messageOf(response.body) ??
            'Não foi possível descrever este ponto (${response.statusCode})',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) return null;
    final parts = decoded['parts'];
    return ReverseGeocodedAddress(
      fullAddress: decoded['fullAddress'] as String?,
      streetAddress: _stringOrNull(parts, 'streetAddress'),
      streetNumber: _stringOrNull(parts, 'streetNumber'),
      neighborhood: _stringOrNull(parts, 'neighborhood'),
      postalCode: _stringOrNull(parts, 'postalCode'),
      city: _stringOrNull(parts, 'city'),
      state: _stringOrNull(parts, 'state'),
    );
  }

  static String? _stringOrNull(Object? parts, String key) {
    if (parts is! Map<String, dynamic>) return null;
    final value = parts[key];
    if (value is! String) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static String? _messageOf(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final message = decoded['message'];
      return message is String && message.trim().isNotEmpty
          ? message.trim()
          : null;
    } catch (_) {
      return null;
    }
  }
}

/// Whether a reverse-geocoded CEP is worth writing over the one on file.
///
/// Mapbox answers a point in Barra da Tijuca with `22775` — the five-digit
/// prefix, not the full CEP. Taking it verbatim replaced a stored `22775-001`
/// with something less precise, so moving the pin one block *lost* data that
/// was already correct. A partial answer is not an improvement on a complete
/// one, so it is only used when the field is empty.
bool isCompleteCep(String? value) {
  if (value == null) return false;
  return RegExp(r'^\d{5}-?\d{3}$').hasMatch(value.trim());
}

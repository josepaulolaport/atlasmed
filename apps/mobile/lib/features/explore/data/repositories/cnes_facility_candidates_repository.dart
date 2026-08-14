import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class CnesFacilityImportException implements Exception {
  const CnesFacilityImportException(this.message, {this.field});

  final String message;

  /// The field the server blamed, so the wizard can point at it.
  final String? field;

  @override
  String toString() => message;
}

/// One row of the CNES offer list.
class CnesFacilityCandidate {
  const CnesFacilityCandidate({
    required this.cnesCode,
    required this.name,
    required this.imported,
    this.municipality,
    this.state,
    this.neighborhood,
    this.streetAddress,
    this.unitTypeName,
    this.legalDocument,
  });

  final String cnesCode;
  final String name;

  /// We already hold this clinic; importing adds a vertical profile only.
  final bool imported;
  final String? municipality;
  final String? state;
  final String? neighborhood;
  final String? streetAddress;
  final String? unitTypeName;
  final String? legalDocument;

  String get whereLabel {
    final parts = [
      if ((neighborhood ?? '').isNotEmpty) neighborhood,
      if ((municipality ?? '').isNotEmpty) municipality,
      if ((state ?? '').isNotEmpty) state,
    ];
    return parts.join(' · ');
  }

  static CnesFacilityCandidate? fromMap(Map<String, dynamic> map) {
    final cnesCode = (map['cnesCode'] as String?)?.trim();
    final name = (map['name'] as String?)?.trim();
    if (cnesCode == null || cnesCode.isEmpty) return null;
    return CnesFacilityCandidate(
      cnesCode: cnesCode,
      name: (name == null || name.isEmpty) ? cnesCode : name,
      imported: map['imported'] == true,
      municipality: (map['municipality'] as String?)?.trim(),
      state: (map['state'] as String?)?.trim(),
      neighborhood: (map['neighborhood'] as String?)?.trim(),
      streetAddress: (map['streetAddress'] as String?)?.trim(),
      unitTypeName: (map['unitTypeName'] as String?)?.trim(),
      legalDocument: (map['legalDocument'] as String?)?.trim(),
    );
  }
}

/// What CNES holds for one establishment, for the wizard to prefill.
class CnesFacilityPreview {
  const CnesFacilityPreview({
    required this.cnesCode,
    required this.suggestedName,
    required this.legalDocumentLocked,
    required this.requiresLocation,
    required this.requiresUnitType,
    required this.alreadyImported,
    required this.existingVerticalIds,
    this.legalDocument,
    this.legalDocumentType,
    this.maintainerTaxId,
    this.streetAddress,
    this.streetNumber,
    this.neighborhood,
    this.postalCode,
    this.phoneNumber,
    this.email,
    this.latitude,
    this.longitude,
    this.municipalityId,
    this.municipalityName,
    this.stateId,
    this.stateAbbreviation,
    this.unitTypeId,
    this.unitTypeCode,
  });

  final String cnesCode;
  final String suggestedName;

  /// CNES supplied the document, so it is read-only: retyping a CNPJ is how two
  /// clinics collide.
  final bool legalDocumentLocked;

  /// CNES has no point and the user must place one before importing.
  final bool requiresLocation;

  /// CNES ships a unit-type code no catalogue defines; the user picks.
  final bool requiresUnitType;
  final bool alreadyImported;
  final List<int> existingVerticalIds;
  final String? legalDocument;
  final String? legalDocumentType;
  final String? maintainerTaxId;
  final String? streetAddress;
  final String? streetNumber;
  final String? neighborhood;
  final String? postalCode;
  final String? phoneNumber;
  final String? email;
  final double? latitude;
  final double? longitude;
  final int? municipalityId;
  final String? municipalityName;
  final int? stateId;
  final String? stateAbbreviation;
  final int? unitTypeId;
  final String? unitTypeCode;

  static CnesFacilityPreview fromMap(Map<String, dynamic> map) {
    double? asDouble(Object? value) =>
        value is num ? value.toDouble() : double.tryParse('${value ?? ''}');
    int? asInt(Object? value) =>
        value is num ? value.toInt() : int.tryParse('${value ?? ''}');

    return CnesFacilityPreview(
      cnesCode: '${map['cnesCode'] ?? ''}',
      suggestedName: '${map['suggestedName'] ?? ''}',
      legalDocumentLocked: map['legalDocumentLocked'] == true,
      requiresLocation: map['requiresLocation'] == true,
      requiresUnitType: map['requiresUnitType'] == true,
      alreadyImported: map['alreadyImported'] == true,
      existingVerticalIds: [
        for (final id in (map['existingVerticalIds'] as List? ?? const []))
          if (asInt(id) != null) asInt(id)!,
      ],
      legalDocument: (map['legalDocument'] as String?)?.trim(),
      legalDocumentType: (map['legalDocumentType'] as String?)?.trim(),
      maintainerTaxId: (map['maintainerTaxId'] as String?)?.trim(),
      streetAddress: (map['streetAddress'] as String?)?.trim(),
      streetNumber: (map['streetNumber'] as String?)?.trim(),
      neighborhood: (map['neighborhood'] as String?)?.trim(),
      postalCode: (map['postalCode'] as String?)?.trim(),
      phoneNumber: (map['phoneNumber'] as String?)?.trim(),
      email: (map['email'] as String?)?.trim(),
      latitude: asDouble(map['latitude']),
      longitude: asDouble(map['longitude']),
      municipalityId: asInt(map['municipalityId']),
      municipalityName: (map['municipalityName'] as String?)?.trim(),
      stateId: asInt(map['stateId']),
      stateAbbreviation: (map['stateAbbreviation'] as String?)?.trim(),
      unitTypeId: asInt(map['unitTypeId']),
      unitTypeCode: (map['unitTypeCode'] as String?)?.trim(),
    );
  }
}

/// What the import did. `CREATED` made a clinic; the others only made it
/// visible to a vertical that could not see it.
enum CnesImportOutcome { created, profileAdded, alreadyVisible }

class CnesFacilityImportResult {
  const CnesFacilityImportResult({
    required this.outcome,
    required this.facilityId,
  });

  final CnesImportOutcome outcome;
  final int facilityId;
}

/// The CNES import surface (spec 0015 §6).
///
/// Deliberately separate from [ClinicsRepository]: that one lists the clinics a
/// user works, this one searches a national registry of ~373 000 establishments
/// they mostly do not. Folding the two together would put a reference list in
/// front of somebody's working set.
class CnesFacilityCandidatesRepository extends Repository<void>
    with SessionEnvironmentMixin<void> {
  CnesFacilityCandidatesRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _base = '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1',
       _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/cnes-candidates',
         ),
         name: 'CnesFacilityCandidatesRepository',
       );

  final String _base;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  void fromJson(String json) {}

  String get _path => '$_base/facilities/cnes-candidates';

  Future<List<CnesFacilityCandidate>> search({
    required String query,
    int limit = 20,
    int offset = 0,
    double? lat,
    double? lng,
  }) async {
    final params = <String, String>{
      'q': query,
      'limit': '$limit',
      'offset': '$offset',
      if (lat != null && lng != null) 'lat': '$lat',
      if (lat != null && lng != null) 'lng': '$lng',
    };
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(_path).replace(queryParameters: params),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw CnesFacilityImportException(
          'Falha ao buscar no CNES (${response.statusCode})',
        );
      }
      return const [];
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];

    final out = <CnesFacilityCandidate>[];
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final candidate = CnesFacilityCandidate.fromMap(item);
      if (candidate != null) out.add(candidate);
    }
    return out;
  }

  Future<CnesFacilityPreview> preview(String cnesCode) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_path/$cnesCode'),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      throw CnesFacilityImportException(
        _messageOf(response.body) ??
            'Falha ao consultar o CNES (${response.statusCode})',
      );
    }

    return CnesFacilityPreview.fromMap(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<CnesFacilityImportResult> import({
    required String cnesCode,
    required Map<String, dynamic> body,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_path/$cnesCode/import'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      throw CnesFacilityImportException(
        _messageOf(response.body) ??
            'Falha ao importar a clínica (${response.statusCode})',
        field: _fieldOf(response.body),
      );
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    final outcome = switch ('${map['outcome']}') {
      'CREATED' => CnesImportOutcome.created,
      'PROFILE_ADDED' => CnesImportOutcome.profileAdded,
      _ => CnesImportOutcome.alreadyVisible,
    };
    final facilityId = map['facilityId'];
    return CnesFacilityImportResult(
      outcome: outcome,
      facilityId: facilityId is num
          ? facilityId.toInt()
          : int.tryParse('$facilityId') ?? 0,
    );
  }

  /*
   * The API nests every error under `error`, and the domain errors this surface
   * raises are the whole point — "this CNPJ belongs to X", "place the clinic on
   * the map". Reading the top level would drop them and leave a bare status
   * code, which reads to a user as the feature being broken.
   */
  String? _messageOf(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final error = decoded['error'];
      final map = error is Map ? error : decoded;
      final details = map['details'];
      if (details is List && details.isNotEmpty) {
        final first = details.first;
        if (first is Map && first['message'] != null) {
          return '${first['message']}';
        }
      }
      final message = map['message'];
      return message is String && message.isNotEmpty ? message : null;
    } catch (_) {
      return null;
    }
  }

  String? _fieldOf(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final error = decoded['error'];
      final map = error is Map ? error : decoded;
      final details = map['details'];
      if (details is List && details.isNotEmpty) {
        final first = details.first;
        if (first is Map && first['field'] != null) return '${first['field']}';
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_associate_mock.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ProfessionalsWriteException implements Exception {
  const ProfessionalsWriteException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'ProfessionalsWriteException';
}

/// Standalone `POST /professionals` (optional facility link + role PATCH).
class ProfessionalsWriteRepository extends Repository<Map<String, dynamic>>
    with SessionEnvironmentMixin<Map<String, dynamic>> {
  ProfessionalsWriteRepository({RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals'),
        resolveOnCreate: false,
        name: 'ProfessionalsWriteRepository',
      );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  Map<String, dynamic> fromJson(String json) {
    return jsonDecode(json) as Map<String, dynamic>;
  }

  Future<FacilityCrmDoctor> createDoctor({
    required String firstName,
    required String lastName,
    String? specialty,
    String? crmNumber,
    String? crmState,
    String? phone,
    String? whatsappNumber,
    String? email,
    String? facilityId,
    int? relationshipLevel,
    bool isPrescriber = false,
    bool isBuyer = false,
    bool isDecisionMaker = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'firstName': firstName,
          'lastName': lastName,
          if (specialty != null && specialty.isNotEmpty)
            'primarySpecialtyLabel': specialty,
          if (crmNumber != null && crmNumber.isNotEmpty) 'crmNumber': crmNumber,
          if (crmState != null && crmState.isNotEmpty) 'crmState': crmState,
          if (phone != null && phone.isNotEmpty) 'mobilePhone': phone,
          if (whatsappNumber != null && whatsappNumber.isNotEmpty)
            'whatsappNumber': whatsappNumber,
          if (email != null && email.isNotEmpty) 'email': email,
          if (facilityId != null && facilityId.isNotEmpty)
            'facilityIds': [facilityId],
          'relationshipLevel': ?relationshipLevel,
        },
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw ProfessionalsWriteException(
          response.statusCode == 403
              ? 'Sem permissão para criar médico.'
              : 'Falha ao criar médico (${response.statusCode})',
        );
      }
    }

    final map = fromJson(response.body);
    final id = map['id'] as String?;
    if (id == null || id.isEmpty) {
      throw const ProfessionalsWriteException(
        'Resposta inválida ao criar médico.',
      );
    }

    final name = (map['fullName'] as String?)?.trim().isNotEmpty == true
        ? (map['fullName'] as String).trim()
        : [
            map['firstName'],
            map['lastName'],
          ].whereType<String>().join(' ').trim();

    if (facilityId != null &&
        facilityId.isNotEmpty &&
        (isPrescriber || isBuyer || isDecisionMaker)) {
      await _patchRoles(
        facilityId: facilityId,
        professionalId: id,
        isPrescriber: isPrescriber,
        isBuyer: isBuyer,
        isDecisionMaker: isDecisionMaker,
      );
    }

    final crmParts = <String>[
      if (crmNumber != null && crmNumber.isNotEmpty) crmNumber,
      if (crmState != null && crmState.isNotEmpty) crmState,
    ];

    return FacilityCrmDoctor(
      id: id,
      name: name.isEmpty ? '$firstName $lastName'.trim() : name,
      initials: initialsFromName(name.isEmpty ? firstName : name),
      hue: hueFromName(name.isEmpty ? firstName : name),
      specialty: specialty ?? map['primarySpecialtyLabel'] as String?,
      crm: crmParts.isEmpty ? null : crmParts.join('/'),
      phone: phone ?? map['mobilePhone'] as String?,
      email: email ?? map['email'] as String?,
      isPrescriber: isPrescriber,
      isBuyer: isBuyer,
      isDecisionMaker: isDecisionMaker,
      roleBadge: isDecisionMaker ? 'DECISOR' : null,
      relationshipScore: relationshipLevel,
    );
  }

  Future<void> _patchRoles({
    required String facilityId,
    required String professionalId,
    required bool isPrescriber,
    required bool isBuyer,
    required bool isDecisionMaker,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
          '/professionals/$professionalId',
        ),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'isPrescriber': isPrescriber,
          'isBuyer': isBuyer,
          'isDecisionMaker': isDecisionMaker,
        },
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw ProfessionalsWriteException(
          'Médico criado, mas falha ao aplicar papéis (${response.statusCode})',
        );
      }
    }
  }
}

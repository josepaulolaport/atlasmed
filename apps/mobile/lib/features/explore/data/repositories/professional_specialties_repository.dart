import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Distinct specialty labels from `GET /api/v1/professionals/specialties`.
class ProfessionalSpecialtiesRepository extends Repository<List<String>>
    with SessionEnvironmentMixin<List<String>> {
  ProfessionalSpecialtiesRepository({
    String? baseUrl,
  }) : super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/professionals/specialties',
         ),
         name: 'ProfessionalSpecialtiesRepository',
       );

  @override
  List<String> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) {
      return const [];
    }
    final data = decoded['data'];
    if (data is! List) {
      return const [];
    }
    return data
        .whereType<String>()
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }
}

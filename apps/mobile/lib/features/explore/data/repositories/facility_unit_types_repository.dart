import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityUnitTypeOption {
  const FacilityUnitTypeOption({
    required this.id,
    required this.name,
    this.cnesCode,
  });

  final int id;
  final String name;
  final String? cnesCode;

  /// CNES writes unit type names in caps ("CLINICA/CENTRO DE ESPECIALIDADES").
  /// Reps read a list of chips, so title-case them.
  String get label => _titleCase(name);
}

/// Catalog from `GET /api/v1/facilities/unit-types`.
///
/// The endpoint returns only unit types some active facility actually has, so
/// the list is short and every option can return results.
class FacilityUnitTypesRepository
    extends Repository<List<FacilityUnitTypeOption>>
    with SessionEnvironmentMixin<List<FacilityUnitTypeOption>> {
  FacilityUnitTypesRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/unit-types',
        ),
        name: 'FacilityUnitTypesRepository',
      );

  @override
  List<FacilityUnitTypeOption> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];

    final options = <FacilityUnitTypeOption>[];
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final id = readCrmIdOrNull(item['id'], 'id');
      final name = (item['name'] as String?)?.trim() ?? '';
      if (id == null || name.isEmpty) continue;
      final cnesCode = (item['cnesCode'] as String?)?.trim();
      options.add(
        FacilityUnitTypeOption(
          id: id,
          name: name,
          cnesCode: (cnesCode == null || cnesCode.isEmpty) ? null : cnesCode,
        ),
      );
    }
    options.sort((a, b) => a.label.compareTo(b.label));
    return options;
  }
}

String _titleCase(String value) {
  final lower = value.toLowerCase();
  final buffer = StringBuffer();
  var startOfWord = true;
  for (final rune in lower.runes) {
    final char = String.fromCharCode(rune);
    if (startOfWord) {
      buffer.write(char.toUpperCase());
    } else {
      buffer.write(char);
    }
    // Slashes and hyphens start a new word too: CNES names are compounds such
    // as "CLINICA/CENTRO DE ESPECIALIDADE".
    startOfWord = char == ' ' || char == '/' || char == '-';
  }
  return buffer.toString();
}

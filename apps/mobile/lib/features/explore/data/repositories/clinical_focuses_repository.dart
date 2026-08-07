import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinical_focus_labels.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ClinicalFocusOption {
  const ClinicalFocusOption({required this.id, required this.name});

  final int id;
  final String name;

  String get label => ClinicalFocusLabels.formatName(name);
}

/// Catalog from `GET /api/v1/facilities/clinical-focuses`.
class ClinicalFocusesRepository extends Repository<List<ClinicalFocusOption>>
    with SessionEnvironmentMixin<List<ClinicalFocusOption>> {
  ClinicalFocusesRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/clinical-focuses',
        ),
        name: 'ClinicalFocusesRepository',
      );

  @override
  List<ClinicalFocusOption> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];

    final options = <ClinicalFocusOption>[];
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final id = readCrmIdOrNull(item['id'], 'id');
      final name = (item['name'] as String?)?.trim() ?? '';
      if (id == null || name.isEmpty) continue;
      options.add(ClinicalFocusOption(id: id, name: name));
    }
    options.sort((a, b) {
      final rank =
          ClinicalFocusLabels.priorityRank(a.name) -
          ClinicalFocusLabels.priorityRank(b.name);
      if (rank != 0) return rank;
      return a.label.compareTo(b.label);
    });
    return options;
  }
}

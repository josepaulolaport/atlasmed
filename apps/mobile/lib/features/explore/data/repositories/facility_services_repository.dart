import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_service_labels.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityServiceOption {
  const FacilityServiceOption({
    required this.serviceCode,
    required this.serviceName,
  });

  final String serviceCode;
  final String serviceName;

  String get label => FacilityServiceLabels.formatName(serviceName);
}

/// Catalog from `GET /api/v1/facilities/services`.
class FacilityServicesRepository extends Repository<List<FacilityServiceOption>>
    with SessionEnvironmentMixin<List<FacilityServiceOption>> {
  FacilityServicesRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/facilities/services',
        ),
        name: 'FacilityServicesRepository',
      );

  @override
  List<FacilityServiceOption> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];

    final options = <FacilityServiceOption>[];
    for (final item in data) {
      if (item is! Map<String, dynamic>) continue;
      final code = (item['serviceCode'] as String?)?.trim() ?? '';
      final name = (item['serviceName'] as String?)?.trim() ?? '';
      if (code.isEmpty || name.isEmpty) continue;
      options.add(FacilityServiceOption(serviceCode: code, serviceName: name));
    }
    options.sort((a, b) {
      final rank =
          FacilityServiceLabels.priorityRank(
            serviceCode: a.serviceCode,
            serviceName: a.serviceName,
          ) -
          FacilityServiceLabels.priorityRank(
            serviceCode: b.serviceCode,
            serviceName: b.serviceName,
          );
      if (rank != 0) return rank;
      return a.label.compareTo(b.label);
    });
    return options;
  }
}

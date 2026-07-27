import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Repository for fetching a single clinic's detail from the API.
class ClinicDetailRepository extends Repository<api.Clinic>
    with SessionEnvironmentMixin<api.Clinic> {
  ClinicDetailRepository({required String id, String? verticalId})
    : super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$id'
          '${verticalId == null || verticalId.isEmpty ? '' : '?verticalId=${Uri.encodeQueryComponent(verticalId)}'}',
        ),
        resolveOnCreate: false,
        name: 'ClinicDetailRepository',
      );

  @override
  api.Clinic fromJson(String json) => api.Clinic.fromJson(json);
}

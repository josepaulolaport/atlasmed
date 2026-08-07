import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Repository for fetching a single facility's detail from the API.
class ClinicDetailRepository extends Repository<FacilityDTO>
    with SessionEnvironmentMixin<FacilityDTO> {
  ClinicDetailRepository({required int id, int? verticalId})
    : super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$id'
          '${verticalId == null || verticalId <= 0 ? '' : '?verticalId=${Uri.encodeQueryComponent(verticalId.toString())}'}',
        ),
        name: 'ClinicDetailRepository',
      );

  @override
  FacilityDTO fromJson(String json) => FacilityDTO.fromJson(json);
}

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Repository for fetching a single facility's detail from the API.
class ClinicDetailRepository extends Repository<Facility>
    with SessionEnvironmentMixin<Facility> {
  ClinicDetailRepository({required String id, String? verticalId})
    : super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$id'
          '${verticalId == null || verticalId.isEmpty ? '' : '?verticalId=${Uri.encodeQueryComponent(verticalId)}'}',
        ),
        name: 'ClinicDetailRepository',
      );

  static Facility parse(String json) =>
      Facility.fromDTO(FacilityDTO.fromJson(json));

  @override
  Facility fromJson(String json) => parse(json);
}
